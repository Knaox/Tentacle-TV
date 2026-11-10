// PiP sous Linux — pas encore branché : la fabrique rend nullptr, les commandes pip_* ne sont
// pas déclarées et la page cache « Réduire » (comme Electron hors de ses montages).
//
// Ce qu'il reste à l'axe linux (docs/INTERFACES.md, « PiP ») : une `pip::Platform` — la fenêtre
// PiP native (`pip::Window`, avec SA pile de couches `Compositor`), le bureau
// (`pip::Desktop`), une minuterie (`pip::Ticker`) — et le prêt de la vidéo dans le
// compositeur de ce système (`Compositor::lendVideo` / `reclaimVideo` / `setVideoInset`).

#include "pip/pip_platform.h"

namespace tentacle::pip {

std::unique_ptr<Platform> createPlatform(SDL_Window*, void*) { return nullptr; }

}  // namespace tentacle::pip
