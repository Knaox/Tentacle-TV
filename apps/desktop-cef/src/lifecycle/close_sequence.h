#pragma once
// Fermer la fenêtre doit emporter le lecteur (`closeSequence.ts` d'Electron, porté à l'identique).
//
// La fenêtre part la PREMIÈRE — cacher est immédiat, le clic sur la croix a l'effet attendu — et
// le lecteur s'arrête ensuite ; la fenêtre n'est détruite qu'une fois mpv rendu, ou à l'échéance.
// (Sous Electron, Linux seulement, où mpv avait sa propre fenêtre de premier niveau ; sous CEF
// mpv dessine dans NOTRE fenêtre sur les trois OS, et la règle vaut partout : la fenêtre cachée
// tout de suite, puis le lecteur démonté avant le navigateur et le compositeur.)
//
// Trois garde-fous : la garde de sortie passe DEVANT (elle a retenu la fermeture : rien), un
// loquet (un second Alt+F4 pendant le démontage laisse passer), un délai de garde (passé lui, la
// fenêtre est détruite même si mpv n'a pas rendu la main : une app qui ne se ferme plus coûte
// plus cher qu'un lecteur mal démonté à la fin d'un processus qui meurt).

#include <cstdint>
#include <functional>
#include <memory>

namespace tentacle::lifecycle {

/// Au-delà, on cesse d'attendre mpv (le double d'un démontage normal).
inline constexpr int64_t kCloseDeadlineMs = 1'500;

/// Ce qu'on demande à la fenêtre, et rien de plus.
struct ClosingWindow {
  std::function<void()> hide;
  std::function<void()> destroy;
  std::function<bool()> isDestroyed;
};

class CloseSequence {
 public:
  using After = std::function<void(int64_t ms, std::function<void()> fn)>;
  CloseSequence(ClosingWindow window, std::function<bool()> playerRunning,
                std::function<void(std::function<void()> done)> stopPlayer, After after,
                int64_t deadlineMs = kCloseDeadlineMs);

  /// Une demande de fermeture ; `defaultPrevented` : la garde de sortie l'a déjà retenue.
  /// Vrai si elle est retenue ici (fenêtre cachée, lecteur en cours d'arrêt).
  bool onClose(bool defaultPrevented);

 private:
  ClosingWindow window_;
  std::function<bool()> playerRunning_;
  std::function<void(std::function<void()>)> stopPlayer_;
  After after_;
  int64_t deadlineMs_;
  bool closing_ = false;
};

}  // namespace tentacle::lifecycle
