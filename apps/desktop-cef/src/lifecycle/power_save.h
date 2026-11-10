#pragma once
// Les deux blocages d'économie d'énergie, et rien d'autre (`powerSave.ts` d'Electron, porté à
// l'identique, et `linux/logindInhibitor.ts` pour le renfort de Linux).
//
// **L'écran**, pendant la lecture (`prevent_display_sleep_start/stop`). **La machine**, pendant
// un transfert (`keepSystemAwake`) : la veille d'inactivité est repoussée SANS empêcher l'écran
// de s'éteindre — on n'allume pas un écran pour un transfert.
//
// Deux exigences : idempotence (le lecteur est remonté à chaque épisode : empiler les blocages en
// laisserait autant d'orphelins) et libération (un blocage actif tient jusqu'à la fin du
// processus : rendu d'office à la sortie). Le système entre par une porte : testable sans OS.

#include <functional>
#include <memory>
#include <string>
#include <vector>

namespace tentacle::lifecycle {

/// Les deux seuls types qu'on demande au système (noms de `powerSaveBlocker`).
enum class BlockerKind { PreventDisplaySleep, PreventAppSuspension };

/// Ce qu'on demande au système (`powerSaveBlocker`), et rien de plus.
class SleepBlocker {
 public:
  virtual ~SleepBlocker() = default;
  virtual int start(BlockerKind kind) = 0;
  virtual void stop(int id) = 0;
  virtual bool isStarted(int id) const = 0;
};

class WakeLock {
 public:
  virtual ~WakeLock() = default;
  /// Pose le blocage. Sans effet s'il est déjà posé.
  virtual void prevent() = 0;
  /// Rend le système à son comportement normal. Sans effet s'il n'y a rien à rendre.
  virtual void release() = 0;
};

/// Empêche l'écran de s'éteindre. Pour la lecture.
std::unique_ptr<WakeLock> createDisplayWakeLock(SleepBlocker& blocker);
/// Empêche la mise en veille du système. Pour les transferts.
std::unique_ptr<WakeLock> createSystemWakeLock(SleepBlocker& blocker);

// ---- Le renfort logind (Linux) ----------------------------------------------------------
// Sous Wayland, l'inhibition du compositeur tient l'écran mais ne retient PAS logind (mesuré par
// Electron) : un `IdleAction=suspend` endormirait la machine. L'inhibiteur de logind est un
// descripteur que tient un processus fils `systemd-inhibit`, qui attend la mort de l'app
// (`tail --pid`) : quelle qu'en soit la cause, le verrou tombe avec elle.

/// Un processus fils, réduit à ce qu'on lui demande.
class ChildProcess {
 public:
  virtual ~ChildProcess() = default;
  virtual void kill() = 0;
  /// A-t-il déjà rendu la main ?
  virtual bool done() = 0;
};

/// Lance une commande ; `nullptr` là où elle n'existe pas.
using Launcher =
    std::function<std::unique_ptr<ChildProcess>(const std::string& command, const std::vector<std::string>& args)>;

/// Le renfort logind. `prevent` idempotent, `release` toujours sûr.
std::unique_ptr<WakeLock> createLogindBackup(Launcher launch, long ownerPid);
/// Plusieurs blocages vus comme un seul — dans l'ordre, dans les deux sens.
std::unique_ptr<WakeLock> combine(std::vector<std::unique_ptr<WakeLock>> locks);

}  // namespace tentacle::lifecycle
