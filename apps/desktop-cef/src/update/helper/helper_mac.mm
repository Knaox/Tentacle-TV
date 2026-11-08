// tentacle-update — l'assistant de remplacement (macOS). Lancé détaché par l'app, copié
// hors du paquet, il attend la fin de l'app puis :
//   apply    : met la nouvelle copie à la place (échange atomique), note la période d'essai,
//              relance si demandé, et revient en arrière si la nouvelle meurt avant d'être
//              « en bonne santé » ;
//   rollback : remet l'ancienne copie (la nouvelle a raté ses lancements) et la relance.
// Journal : <state-dir>/helper.log.
//   tentacle-update apply    --pid N --app A --staged S --state-dir D --version V [--relaunch -- args…]
//   tentacle-update rollback --pid N --app A --previous P --state-dir D --version V [--relaunch -- args…]
#import <Foundation/Foundation.h>
#include <fcntl.h>
#include <signal.h>
#include <spawn.h>
#include <sys/event.h>
#include <sys/wait.h>
#include <unistd.h>

#include <cstdio>
#include <ctime>
#include <map>
#include <string>
#include <vector>

#include "platform/macos/update_bundle_mac.h"
#include "update/state.h"

extern char** environ;

using namespace tentacle::update;

namespace {

void say(const char* fmt, const std::string& a = {}, const std::string& b = {}) {
  char when[32];
  const time_t t = time(nullptr);
  strftime(when, sizeof when, "%H:%M:%S", localtime(&t));
  std::fprintf(stderr, "[%s] ", when);
  std::fprintf(stderr, fmt, a.c_str(), b.c_str());
  std::fputc('\n', stderr);
}

// Attend la fin du processus `pid` (kqueue), au plus `seconds`.
bool waitForExit(pid_t pid, int seconds) {
  const int kq = kqueue();
  struct kevent ev;
  EV_SET(&ev, pid, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, nullptr);
  if (kevent(kq, &ev, 1, nullptr, 0, nullptr) < 0) {
    close(kq);
    return errno == ESRCH;  // déjà terminé
  }
  struct timespec timeout {seconds, 0};
  const int n = kevent(kq, nullptr, 0, &ev, 1, &timeout);
  close(kq);
  return n > 0;
}

pid_t launch(const std::string& app, const std::vector<std::string>& args, const std::string& log) {
  const std::string exe = mac::executableOf(app);
  if (exe.empty()) return -1;
  std::vector<char*> argv{const_cast<char*>(exe.c_str())};
  for (auto& a : args) argv.push_back(const_cast<char*>(a.c_str()));
  argv.push_back(nullptr);
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  posix_spawn_file_actions_addopen(&fa, 0, "/dev/null", O_RDONLY, 0);
  posix_spawn_file_actions_addopen(&fa, 1, log.c_str(), O_WRONLY | O_CREAT | O_APPEND, 0600);
  posix_spawn_file_actions_adddup2(&fa, 1, 2);
  posix_spawnattr_t attr;
  posix_spawnattr_init(&attr);
  posix_spawnattr_setflags(&attr, POSIX_SPAWN_SETSID | POSIX_SPAWN_CLOEXEC_DEFAULT);
  pid_t pid = -1;
  if (posix_spawn(&pid, exe.c_str(), &fa, &attr, argv.data(), environ) != 0) pid = -1;
  posix_spawn_file_actions_destroy(&fa);
  posix_spawnattr_destroy(&attr);
  return pid;
}

struct Args {
  std::string mode;
  std::map<std::string, std::string> opt;
  bool relaunch = false;
  std::vector<std::string> appArgs;
  std::string get(const char* k) const {
    auto it = opt.find(k);
    return it == opt.end() ? std::string() : it->second;
  }
};

Args parse(int argc, char** argv) {
  Args a;
  if (argc > 1) a.mode = argv[1];
  for (int i = 2; i < argc; ++i) {
    const std::string k = argv[i];
    if (k == "--") {
      for (++i; i < argc; ++i) a.appArgs.emplace_back(argv[i]);
      break;
    }
    if (k == "--relaunch") a.relaunch = true;
    else if (k.rfind("--", 0) == 0 && i + 1 < argc) a.opt[k.substr(2)] = argv[++i];
  }
  return a;
}

// Revient à l'ancienne copie, retient la version fautive, relance l'ancienne.
int rollback(const Args& a, const std::string& previous) {
  const std::string app = a.get("app"), dir = a.get("state-dir"), version = a.get("version");
  Probation p = loadProbation(dir + "/probation.json").value_or(Probation{});
  if (previous.empty() || !mac::swapBack(app, previous).empty()) {
    // Rien à remettre : l'app ne doit pas réessayer (et quitter) à chaque lancement.
    say("retour arrière impossible (ancienne copie absente ou inamovible) : on garde %s", version);
    p.previousPath.clear();
    p.healthy = true;
    saveProbation(dir + "/probation.json", p);
    if (a.relaunch) launch(app, a.appArgs, dir + "/relaunched.log");
    return 5;
  }
  p.version = version;
  p.rolledBack = version;
  p.previousPath.clear();
  p.healthy = false;
  saveProbation(dir + "/probation.json", p);
  say("revenu à l'ancienne copie (%s abandonnée)", version);
  if (a.relaunch && launch(app, a.appArgs, dir + "/relaunched.log") < 0) say("relance impossible");
  return 0;
}

int apply(const Args& a) {
  const std::string app = a.get("app"), staged = a.get("staged"), dir = a.get("state-dir"),
                    version = a.get("version");
  const std::string previous = mac::previousPath(app);
  // Recontrôle JUSTE avant l'échange : la copie préparée a pu attendre des jours à côté de
  // l'app, dans un dossier qu'un autre processus de l'utilisateur pouvait toucher.
  if (std::string err = mac::verifyStaged(staged, version, mac::bundleIdOf(app)); !err.empty()) {
    mac::removeTree(mac::stagingRoot(app));
    return say("copie préparée refusée au dernier contrôle : %s", err), 6;
  }
  bool atomic = false;
  if (std::string err = mac::swapIn(app, staged, previous, &atomic); !err.empty()) return say("échange raté : %s", err), 3;
  mac::removeTree(mac::stagingRoot(app));
  say(atomic ? "%s en place, échange atomique (ancienne copie : %s)" : "%s en place, deux rename (ancienne copie : %s)",
      version, previous);
  Probation fresh;
  fresh.version = version;
  fresh.previousPath = previous;
  fresh.appPath = app;
  saveProbation(dir + "/probation.json", fresh);
  if (!a.relaunch) return 0;

  const pid_t child = launch(app, a.appArgs, dir + "/relaunched.log");
  if (child < 0) return say("relance impossible : retour arrière"), rollback(a, previous);
  say("relancée (pid %s), période d'essai", std::to_string(child));
  // Jusqu'à 90 s : la nouvelle version se déclare en bonne santé, ou meurt avant.
  for (int i = 0; i < 360; ++i) {
    usleep(250 * 1000);
    if (auto p = loadProbation(dir + "/probation.json"); p && p->healthy) {
      say("%s en bonne santé : ancienne copie effacée", version);
      mac::removeTree(previous);
      return 0;
    }
    int status = 0;
    if (waitpid(child, &status, WNOHANG) == child) {
      // Fermée proprement par l'utilisateur (code 0) : elle a marché, ce n'est pas un échec.
      if (WIFEXITED(status) && WEXITSTATUS(status) == 0) {
        say("%s fermée proprement avant le signal de santé : gardée", version);
        return 0;
      }
      say("%s s'est arrêtée avant d'être prête (statut %s) : retour arrière", version, std::to_string(status));
      return rollback(a, previous);
    }
  }
  // Vivante mais muette : on la laisse, le compteur de lancements de l'app prend le relais.
  say("%s vivante sans signal de santé : surveillance rendue à l'app", version);
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
  @autoreleasepool {
    const Args a = parse(argc, argv);
    const pid_t pid = pid_t(std::atoi(a.get("pid").c_str()));
    if ((a.mode != "apply" && a.mode != "rollback") || pid <= 0 || a.get("app").empty() || a.get("state-dir").empty()) {
      std::fprintf(stderr, "usage : tentacle-update apply|rollback --pid N --app A …\n");
      return 64;
    }
    say("%s : attente de la fin de l'app (pid %s)", a.mode, a.get("pid"));
    if (!waitForExit(pid, 120)) return say("l'app ne s'est pas arrêtée : abandon"), 2;
    if (a.mode == "rollback") return rollback(a, a.get("previous"));
    return apply(a);
  }
}
