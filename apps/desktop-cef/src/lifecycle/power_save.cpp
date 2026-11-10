#include "lifecycle/power_save.h"

#include <optional>

namespace tentacle::lifecycle {
namespace {

// Le mécanisme, écrit une seule fois pour les deux blocages : chaque appel produit un état
// INDÉPENDANT, l'anti-veille de l'écran et l'anti-suspension des transferts cohabitent.
class Blocker final : public WakeLock {
 public:
  Blocker(SleepBlocker& blocker, BlockerKind kind) : blocker_(blocker), kind_(kind) {}
  void prevent() override {
    // `isStarted` plutôt que la seule présence de l'identifiant : le système peut avoir levé le
    // blocage de son côté, et on croirait l'écran protégé sans qu'il le soit.
    if (blocking_ && blocker_.isStarted(*blocking_)) return;
    blocking_ = blocker_.start(kind_);
  }
  void release() override {
    if (!blocking_) return;
    if (blocker_.isStarted(*blocking_)) blocker_.stop(*blocking_);
    blocking_.reset();
  }

 private:
  SleepBlocker& blocker_;
  BlockerKind kind_;
  std::optional<int> blocking_;
};

constexpr const char* kWho = "Tentacle TV";
constexpr const char* kWhy = "Lecture vidéo en cours";  // libellé d'Electron, gardé tel quel

class LogindBackup final : public WakeLock {
 public:
  LogindBackup(Launcher launch, long ownerPid) : launch_(std::move(launch)), ownerPid_(ownerPid) {}
  void prevent() override {
    if (child_ && !child_->done()) return;
    child_.reset();
    if (!launch_) return;
    // `idle:sleep` couvre le délai d'inactivité ET une demande de veille explicite. Le fils ne
    // fait rien : c'est le descripteur qu'il tient ouvert qui compte, jusqu'à notre mort.
    child_ = launch_("systemd-inhibit",
                     {"--what=idle:sleep", std::string("--who=") + kWho, std::string("--why=") + kWhy,
                      "--mode=block", "tail", "--pid=" + std::to_string(ownerPid_), "-f", "/dev/null"});
  }
  void release() override {
    if (!child_) return;
    if (!child_->done()) child_->kill();
    child_.reset();
  }

 private:
  Launcher launch_;
  long ownerPid_;
  std::unique_ptr<ChildProcess> child_;
};

class Combined final : public WakeLock {
 public:
  explicit Combined(std::vector<std::unique_ptr<WakeLock>> locks) : locks_(std::move(locks)) {}
  void prevent() override {
    for (auto& lock : locks_) lock->prevent();
  }
  void release() override {
    for (auto& lock : locks_) lock->release();
  }

 private:
  std::vector<std::unique_ptr<WakeLock>> locks_;
};

}  // namespace

std::unique_ptr<WakeLock> createDisplayWakeLock(SleepBlocker& blocker) {
  return std::make_unique<Blocker>(blocker, BlockerKind::PreventDisplaySleep);
}

std::unique_ptr<WakeLock> createSystemWakeLock(SleepBlocker& blocker) {
  return std::make_unique<Blocker>(blocker, BlockerKind::PreventAppSuspension);
}

std::unique_ptr<WakeLock> createLogindBackup(Launcher launch, long ownerPid) {
  return std::make_unique<LogindBackup>(std::move(launch), ownerPid);
}

std::unique_ptr<WakeLock> combine(std::vector<std::unique_ptr<WakeLock>> locks) {
  return std::make_unique<Combined>(std::move(locks));
}

}  // namespace tentacle::lifecycle
