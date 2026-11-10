#pragma once
// L'axe réseau dans l'app : schémas `tentacle://art` (et suivants) et commandes de
// `window.tentacle` qu'il sert. Depuis `src/app/modules.cpp`, sur le fil principal, après
// `pont::install` (le registre existe) et AVANT `pont::installShim` (capabilities figées).

namespace tentacle {
struct AppContext;
}

namespace tentacle::reseau {

void install(AppContext& ctx);
void shutdown();

}  // namespace tentacle::reseau
