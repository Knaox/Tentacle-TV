// MPRIS (Linux) — la pochette sur le disque. MPRIS ne transporte qu'une ADRESSE (`mpris:artUrl`) ;
// celle du serveur porte le jeton du compte et ne sort jamais du processus : les octets
// téléchargés par le cœur sont copiés dans `$XDG_RUNTIME_DIR` (dossier 0700 de l'utilisateur,
// en mémoire, vidé à la fin de la session), sinon le dossier temporaire du système.
//
// - un fichier 0600, créé en exclusif (`O_EXCL | O_NOFOLLOW` : aucun lien piégé suivi) ;
// - une NOUVELLE pochette = un NOUVEAU nom : GNOME Shell garde l'image d'une URI déjà vue ;
// - l'ancienne copie effacée aussitôt, toutes à la désactivation et à la destruction.
#include <fcntl.h>
#include <unistd.h>

#include <cerrno>
#include <cstdio>
#include <cstring>
#include <random>
#include <string_view>
#include <system_error>

#include "media_session_linux.h"

namespace tentacle::media_session::mpris {
namespace {

std::filesystem::path artworkDir() {
  std::error_code ec;
  const char* runtime = g_getenv("XDG_RUNTIME_DIR");
  if (runtime && *runtime && std::filesystem::is_directory(runtime, ec)) {
    const std::filesystem::path dir = runtime;
    // Flatpak : seul `$XDG_RUNTIME_DIR/app/<id>` est vu de l'hôte (GNOME Shell, Plasma).
    if (const char* app = g_getenv("FLATPAK_ID"); app && *app) {
      const std::filesystem::path shared = dir / "app" / app;
      if (std::filesystem::is_directory(shared, ec)) return shared;
    }
    return dir;
  }
  return g_get_tmp_dir();
}

// L'extension d'après le type annoncé, sinon d'après les premiers octets.
const char* extensionOf(const Artwork& artwork) {
  const std::string_view mime = std::string_view(artwork.mime).substr(0, artwork.mime.find(';'));
  if (mime == "image/jpeg" || mime == "image/jpg") return ".jpg";
  if (mime == "image/png") return ".png";
  if (mime == "image/webp") return ".webp";
  if (mime == "image/gif") return ".gif";
  if (mime == "image/avif") return ".avif";
  const std::vector<uint8_t>& b = artwork.bytes;
  auto at = [&b](size_t offset, std::string_view magic) {
    return b.size() >= offset + magic.size() && std::memcmp(b.data() + offset, magic.data(), magic.size()) == 0;
  };
  if (at(0, "\xFF\xD8\xFF")) return ".jpg";
  if (at(0, "\x89PNG")) return ".png";
  if (at(0, "GIF8")) return ".gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return ".webp";
  return ".img";
}

bool writeAll(int fd, const std::vector<uint8_t>& bytes) {
  size_t done = 0;
  while (done < bytes.size()) {
    const ssize_t n = ::write(fd, bytes.data() + done, bytes.size() - done);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) return false;
    done += size_t(n);
  }
  return true;
}

}  // namespace

ArtworkFile::ArtworkFile() : dir_(artworkDir()) {
  // Propre au processus (pid) et à cette instance (aléa) : deux Tentacle ne se marchent pas dessus.
  char token[16];
  std::snprintf(token, sizeof token, "%08x", unsigned(std::random_device{}()));
  prefix_ = "tentacle-mpris-" + std::to_string(getpid()) + "-" + token + "-";
}

ArtworkFile::~ArtworkFile() { clear(); }

const std::string& ArtworkFile::update(const std::shared_ptr<const Artwork>& artwork) {
  if (artwork == current_) return uri_;  // la même pochette (le cœur la garde par adresse)
  clear();
  current_ = artwork;  // même en échec d'écriture : pas de nouvel essai pour la même image
  if (!artwork || artwork->bytes.empty()) return uri_;
  // Un nom déjà pris (reste d'un processus tué au même pid) : le suivant.
  for (int attempt = 0; attempt < 3; ++attempt)
    if (write(*artwork)) break;
  return uri_;
}

bool ArtworkFile::write(const Artwork& artwork) {
  const std::filesystem::path path = dir_ / (prefix_ + std::to_string(++seq_) + extensionOf(artwork));
  const int fd = ::open(path.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (fd < 0) {
    std::fprintf(stderr, "[mpris] pochette non écrite (%s) : %s\n", path.c_str(), std::strerror(errno));
    return false;
  }
  const bool written = writeAll(fd, artwork.bytes);
  const bool closed = ::close(fd) == 0;
  gchar* uri = written && closed ? g_filename_to_uri(path.c_str(), nullptr, nullptr) : nullptr;
  if (!uri) {
    ::unlink(path.c_str());
    return false;
  }
  path_ = path;
  uri_ = uri;
  g_free(uri);
  return true;
}

void ArtworkFile::clear() {
  if (!path_.empty()) ::unlink(path_.c_str());
  path_.clear();
  uri_.clear();
  current_.reset();
}

}  // namespace tentacle::media_session::mpris
