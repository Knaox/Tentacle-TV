// Les canaux de fenêtre dont le lecteur du front a besoin.
//
// Sémantique de la coquille Electron (`main/ipc/shell.ts`, `playerFullscreenSession.ts`) :
//   toggle_fullscreen        → le NOUVEL état (bool)
//   player_fullscreen_enter  → l'état COURANT (ne bascule pas : ouvre la « session »
//                              du film, que le front rouvre à chaque épisode)
//   player_fullscreen_leave  → sur macOS, rien d'autre que fermer la session : la
//                              fenêtre reste comme l'utilisateur l'a laissée
//   window://fullscreen      → à CHAQUE changement réel, y compris hors de l'appli
//                              (bouton vert, ⌃⌘F) : sans lui, icône et Échap mentent
//   prevent_display_sleep_start / _stop, player_surface_transparent
#pragma once

#include <functional>
#include <optional>

#include "ports.h"
#include "registry.h"

namespace bridge {

class WindowChannels {
 public:
  WindowChannels(Registry& registry, WindowPort& window);

  /// À appeler par l'adaptateur de la fenêtre quand l'état réel change.
  void fullscreenChanged(bool on);
  /// `player_surface_transparent {on}` de la page (verre natif : opaque, il se cache).
  void setSurfaceListener(std::function<void(bool)> listener) { surfaceListener_ = std::move(listener); }

 private:
  Registry& registry_;
  WindowPort& window_;
  std::optional<bool> sessionStartedFullscreen_;  // nullopt : pas de session ouverte
  bool lastEmitted_ = false;
  std::function<void(bool)> surfaceListener_;
};

}  // namespace bridge
