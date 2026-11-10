#pragma once
// Le PiP dans l'app. Depuis `src/app/modules.cpp`, sur le fil principal :
//   tentacle::pip::install(ctx, pont::registry());   // AVANT pont::installShim (capabilities)
//   tentacle::pip::shutdown();                       // dans shutdownModules
//
// Sans PiP sur ce système (`createPlatform` → nullptr), rien n'est déclaré : la page cache
// « Réduire ». Diagnostic (bancs, hors `window.tentacle`) : `pip.debug.state` ; avec
// `--debug-input`, `pip.debug.cursor {x, y}` remplace le curseur que suivent les gestes
// (`null` le rend), sans toucher au vrai.

namespace bridge {
class Registry;
}

namespace tentacle {
struct AppContext;
}

namespace tentacle::pip {

void install(AppContext& ctx, bridge::Registry& registry);
/// Ferme un PiP encore ouvert (son navigateur doit partir avant CefShutdown).
void shutdown();

}  // namespace tentacle::pip
