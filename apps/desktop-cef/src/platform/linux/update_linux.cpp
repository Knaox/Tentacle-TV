// Linux : l'implémentation système du moteur de mise à jour.
// Construite et éprouvée sur un vrai noyau Linux (conteneur Debian, bench/update/cross-test.sh :
// moteur réel, fausses AppImages, flux signé local) ; pas encore dans une vraie AppImage de l'app.
//
// Seule l'AppImage se met à jour elle-même (comme le bureau Electron : `linux/update.ts`).
// Un paquet .deb/.rpm/pacman relève du gestionnaire de paquets (dépôt signé) : le moteur ne
// l'installe pas en silence — pkexec demanderait un mot de passe à la fermeture. Il se tait
// (mineure, majeure) ou prévient sans bloquer (obligatoire : « mettez à jour avec … »).
// Delta : zsync (AppImageUpdate) est la suite naturelle ; ici, l'AppImage entière.
#include <curl/curl.h>
#include <fcntl.h>
#include <spawn.h>
#include <stdio.h>
#include <sys/stat.h>
#include <unistd.h>

#include <atomic>
#include <chrono>
#include <cstring>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <thread>

#include "update/system.h"

#ifndef TENTACLE_APP_VERSION
#define TENTACLE_APP_VERSION "0.1.0"
#endif

extern char** environ;

namespace tentacle::update {
namespace {

namespace fs = std::filesystem;
using Clock = std::chrono::steady_clock;

// Le guetteur de relance (sh, détaché) : attend la fin de l'app, relance la nouvelle version
// et, comme l'assistant macOS, la surveille 90 s. Morte avant sa « bonne santé » (probation.json)
// avec un code non nul — plantage au démarrage compris, avant même le moteur — : l'ancienne
// copie est remise, le retour arrière noté, l'ancienne version relancée. Fermée proprement
// (code 0) : gardée. Sans ancienne copie ($3 vide) : simple relance.
//   $1 pid  $2 AppImage  $3 ancienne copie  $4 version  $5 probation.json  $6… arguments
constexpr const char* kWatcher = R"sh(
pid=$1 app=$2 prev=$3 ver=$4 prob=$5; shift 5
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
[ -n "$prev" ] || exec "$app" "$@"
"$app" "$@" & child=$!
n=0
while [ $n -lt 450 ]; do
  grep -Eq '"healthy" *: *true' "$prob" 2>/dev/null && exit 0
  state=$(sed 's/.*) //' "/proc/$child/stat" 2>/dev/null | cut -c1)
  if [ -z "$state" ] || [ "$state" = Z ]; then
    wait "$child" && exit 0
    [ -e "$prev" ] || exit 0
    mv -f "$prev" "$app" || exit 0
    printf '{"version":"%s","previousPath":"","appPath":"","launches":0,"healthy":false,"rolledBack":"%s"}\n' \
      "$ver" "$ver" > "$prob.tmp" && mv -f "$prob.tmp" "$prob"
    exec "$app" "$@"
  fi
  sleep 0.2; n=$((n+1))
done
)sh";

std::string appImage() {
  const char* p = std::getenv("APPIMAGE");
  return p ? p : "";
}

std::vector<std::string> ownArgs() {
  std::ifstream in("/proc/self/cmdline", std::ios::binary);
  std::vector<std::string> args;
  std::string a;
  while (std::getline(in, a, '\0')) args.push_back(a);
  if (!args.empty()) args.erase(args.begin());
  return args;
}

struct Transfer {
  FILE* file = nullptr;
  std::string body;
  size_t max = 0;
  Platform::Progress progress;
  std::function<void(std::function<void()>)> post;
  std::shared_ptr<std::atomic<bool>> cancelled;
  Clock::time_point lastPost{};
};

size_t onData(char* data, size_t size, size_t n, void* user) {
  auto* t = static_cast<Transfer*>(user);
  if (t->file) return std::fwrite(data, size, n, t->file);
  if (t->body.size() + size * n > t->max) return 0;  // trop gros : abandon
  t->body.append(data, size * n);
  return size * n;
}

int onProgress(void* user, curl_off_t total, curl_off_t got, curl_off_t, curl_off_t) {
  auto* t = static_cast<Transfer*>(user);
  if (t->cancelled && *t->cancelled) return 1;  // abandon demandé : curl s'arrête
  // Au plus 10 fois par seconde vers le fil principal (curl appelle à chaque bloc reçu).
  const auto now = Clock::now();
  if (t->progress && got > 0 && (now - t->lastPost >= std::chrono::milliseconds(100) || got == total)) {
    t->lastPost = now;
    auto p = t->progress;
    t->post([p, got, total] { p(uint64_t(got), uint64_t(total)); });
  }
  return 0;
}

// Rend « » si tout va bien, sinon l'erreur ; `network` pour une panne de réseau.
std::string perform(const std::string& url, Transfer& t, bool& network) {
  CURL* c = curl_easy_init();
  curl_easy_setopt(c, CURLOPT_URL, url.c_str());
  curl_easy_setopt(c, CURLOPT_FOLLOWLOCATION, 1L);
  // http : boucle locale seulement (le moteur filtre les URL) ; une redirection reste en https.
#if LIBCURL_VERSION_NUM >= 0x075500  // 7.85 : listes en texte (Ubuntu 22.04 a 7.81)
  curl_easy_setopt(c, CURLOPT_PROTOCOLS_STR, "https,http");
  curl_easy_setopt(c, CURLOPT_REDIR_PROTOCOLS_STR, "https");
#else
  curl_easy_setopt(c, CURLOPT_PROTOCOLS, long(CURLPROTO_HTTPS | CURLPROTO_HTTP));
  curl_easy_setopt(c, CURLOPT_REDIR_PROTOCOLS, long(CURLPROTO_HTTPS));
#endif
  curl_easy_setopt(c, CURLOPT_CONNECTTIMEOUT, 20L);
  curl_easy_setopt(c, CURLOPT_WRITEFUNCTION, onData);
  curl_easy_setopt(c, CURLOPT_WRITEDATA, &t);
  curl_easy_setopt(c, CURLOPT_XFERINFOFUNCTION, onProgress);
  curl_easy_setopt(c, CURLOPT_XFERINFODATA, &t);
  curl_easy_setopt(c, CURLOPT_NOPROGRESS, (t.progress || t.cancelled) ? 0L : 1L);
  const CURLcode rc = curl_easy_perform(c);
  long status = 0;
  curl_easy_getinfo(c, CURLINFO_RESPONSE_CODE, &status);
  curl_easy_cleanup(c);
  network = rc == CURLE_COULDNT_RESOLVE_HOST || rc == CURLE_COULDNT_CONNECT || rc == CURLE_OPERATION_TIMEDOUT ||
            rc == CURLE_RECV_ERROR || rc == CURLE_SEND_ERROR || rc == CURLE_PARTIAL_FILE;
  if (rc == CURLE_ABORTED_BY_CALLBACK) return "cancelled";
  if (rc != CURLE_OK) return curl_easy_strerror(rc);
  if (status != 200) return "http-" + std::to_string(status);
  return {};
}

// Une AppImage de type 2 : ELF + « AI\x02 » à l'octet 8.
bool looksLikeAppImage(const std::string& path) {
  unsigned char head[11] = {};
  std::ifstream in(path, std::ios::binary);
  in.read(reinterpret_cast<char*>(head), sizeof head);
  return in && std::memcmp(head, "\x7f" "ELF", 4) == 0 && head[8] == 'A' && head[9] == 'I' && head[10] == 2;
}

class LinuxPlatform : public Platform {
 public:
  explicit LinuxPlatform(SystemHooks h) : h_(std::move(h)) {
    fs::create_directories(h_.stateDir);
    curl_global_init(CURL_GLOBAL_DEFAULT);
  }
  std::optional<Version> currentVersion() override { return Version::parse(TENTACLE_APP_VERSION); }
  std::string platformKey() override {
#if defined(__aarch64__)
    return "linux-arm64-appimage";
#else
    return "linux-x86_64-appimage";
#endif
  }
  std::string stateDir() override { return h_.stateDir; }
  int64_t now() override { return int64_t(std::time(nullptr)); }
  bool canSelfUpdate(std::string* why) override {
    auto no = [why](const char* reason) {
      if (why) *why = reason;
      return false;
    };
    const std::string app = appImage();
    if (app.empty()) return no("package-manager");
    if (access(fs::path(app).parent_path().c_str(), W_OK) != 0) return no("not-writable");
    return true;
  }
  void fetch(const std::string& url, size_t maxBytes, FetchDone done) override {
    auto post = h_.post;
    std::thread([url, maxBytes, done, post] {
      Transfer t;
      t.max = maxBytes;
      bool network = false;
      const std::string err = perform(url, t, network);
      std::optional<std::string> body;
      if (err.empty()) body = std::move(t.body);
      post([done, body, err] { done(body, err); });
    }).detach();
  }
  void download(const std::string& url, const std::string& dest, Progress progress, DownloadDone done) override {
    cancelDownload();  // un seul téléchargement à la fois vers le même fichier
    cancel_ = std::make_shared<std::atomic<bool>>(false);
    auto post = h_.post;
    auto cancelled = cancel_;
    std::thread([url, dest, progress, done, post, cancelled] {
      Transfer t;
      t.file = std::fopen(dest.c_str(), "wb");
      t.progress = progress;
      t.post = post;
      t.cancelled = cancelled;
      bool network = false;
      std::string err = t.file ? perform(url, t, network) : "open";
      if (t.file) std::fclose(t.file);
      if (!*cancelled) post([done, err, network] { done(err, network); });
    }).detach();
  }
  void cancelDownload() override {
    if (cancel_) *cancel_ = true;
  }
  void background(std::function<void()> work, std::function<void()> then) override {
    auto post = h_.post;
    std::thread([work, then, post] {
      work();
      post(then);
    }).detach();
  }
  void schedule(int64_t delayMs, std::function<void()> fn) override { h_.postDelayed(delayMs, std::move(fn)); }

  std::string stage(const std::string& archive, const Manifest&, std::string* staged) override {
    // L'archive EST la nouvelle AppImage (vérifiée par SHA-256). Rangée à côté, même volume.
    if (!looksLikeAppImage(archive)) return "not-an-appimage";
    const fs::path app = appImage();
    const fs::path next = app.parent_path() / ("." + app.filename().string() + ".update");
    std::error_code ec;
    fs::copy_file(archive, next, fs::copy_options::overwrite_existing, ec);
    if (ec) return "copy:" + ec.message();
    chmod(next.c_str(), 0755);
    *staged = next;
    return {};
  }
  void discardStaged(const std::string& staged) override { std::remove(staged.c_str()); }
  std::string apply(const std::string& staged, const Version& v, bool relaunch) override {
    // Un exécutable en cours se renomme sans dommage (son inode survit) : l'échange se fait
    // tout de suite, atomique (renameat2 RENAME_EXCHANGE, noyau ≥ 3.15).
    const std::string app = appImage(), previous = staged.substr(0, staged.size() - 7) + ".previous";
    if (renameat2(AT_FDCWD, staged.c_str(), AT_FDCWD, app.c_str(), RENAME_EXCHANGE) == 0) {
      std::rename(staged.c_str(), previous.c_str());
    } else if (std::rename(app.c_str(), previous.c_str()) != 0 || std::rename(staged.c_str(), app.c_str()) != 0) {
      std::rename(previous.c_str(), app.c_str());
      return std::string("swap:") + std::strerror(errno);
    }
    Probation p;
    p.version = v.str();
    p.previousPath = previous;
    p.appPath = app;
    saveProbation(h_.stateDir + "/probation.json", p);
    if (relaunch) relaunchAfterExit(app, previous, p.version);
    return {};
  }
  std::string rollback(const Probation& p) override {
    if (renameat2(AT_FDCWD, p.previousPath.c_str(), AT_FDCWD, p.appPath.c_str(), RENAME_EXCHANGE) != 0)
      return std::string("swap-back:") + std::strerror(errno);
    std::remove(p.previousPath.c_str());
    Probation back = p;
    back.rolledBack = p.version;
    back.previousPath.clear();
    saveProbation(h_.stateDir + "/probation.json", back);
    relaunchAfterExit(p.appPath, "", p.version);
    return {};
  }
  void removeTree(const std::string& path) override {
    std::error_code ec;
    fs::remove_all(path, ec);
  }
  void quitApp() override { h_.quit(); }

 private:
  // Relance après la fin de ce processus (le profil CEF doit être libéré), par le guetteur sh.
  void relaunchAfterExit(const std::string& app, const std::string& previous, const std::string& version) {
    std::vector<std::string> a{"/bin/sh", "-c", kWatcher, "sh", std::to_string(getpid()), app, previous, version,
                               h_.stateDir + "/probation.json"};
    for (auto& x : ownArgs()) a.push_back(x);
    std::vector<char*> argv;
    for (auto& x : a) argv.push_back(x.data());
    argv.push_back(nullptr);
    posix_spawnattr_t attr;
    posix_spawnattr_init(&attr);
    posix_spawnattr_setflags(&attr, POSIX_SPAWN_SETSID);
    pid_t child;
    posix_spawn(&child, "/bin/sh", nullptr, &attr, argv.data(), environ);
    posix_spawnattr_destroy(&attr);
  }

  SystemHooks h_;
  std::shared_ptr<std::atomic<bool>> cancel_;
};

}  // namespace

std::unique_ptr<Platform> createSystemPlatform(SystemHooks hooks) {
  return std::make_unique<LinuxPlatform>(std::move(hooks));
}

void openExternalUrl(const std::string& url) {
  const char* argv[] = {"xdg-open", url.c_str(), nullptr};
  pid_t pid;
  posix_spawnp(&pid, "xdg-open", nullptr, nullptr, const_cast<char**>(argv), environ);
}

}  // namespace tentacle::update
