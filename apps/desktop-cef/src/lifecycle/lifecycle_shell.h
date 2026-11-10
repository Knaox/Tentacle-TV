#pragma once
// Le cycle de vie dans `src/app/modules.cpp` (avant `pont::installShim`, qui fige la liste) :
//
//   lifecycle::install(ctx, pont::registry());   // app_link_take, app-link, open-external,
//                                                 // pick-folder, relaunch, focus de la fenêtre
//   lifecycle::setVideoControls({…});            // le lecteur du pont, vu de la fermeture
//
// Hors de la liste de `window.tentacle.capabilities` (comme sous Electron, où le preload les
// expose nommément) : `tentacle:open-external`, `tentacle:pick-folder`, `tentacle:relaunch`,
// et les canaux du focus `lifecycle.windowFocus` (évènement) / `lifecycle.windowFocus.get`.

#include <functional>
#include <string>

#include "lifecycle/lifecycle.h"

namespace bridge {
class Registry;
}

namespace tentacle {
struct AppContext;
}

namespace tentacle::lifecycle {

/// Le lecteur vidéo vu de la fermeture (fourni par le pont, `src/app/modules.cpp`).
struct VideoControls {
  std::function<bool()> running;
  std::function<void(std::function<void()> done)> stop;
  /// Écriture ASYNCHRONE de `pause=yes` (le son se tait pendant l'adieu à Jellyfin).
  std::function<void()> pause;
};
void setVideoControls(VideoControls controls);

void install(AppContext& ctx, bridge::Registry& registry);

/// Interne (lifecycle_app.cpp) : le lecteur déclaré par le pont.
const VideoControls& videoControls();
/// Interne : un lien remis par le système (Apple event, ligne de commande, seconde instance).
/// Vrai si c'était un lien d'app.
bool deliverAppLink(const std::string& raw);
/// Interne : le lien du lancement, gardé pour `app_link_take`.
void keepLaunchLink(int argc, char** argv);

}  // namespace tentacle::lifecycle
