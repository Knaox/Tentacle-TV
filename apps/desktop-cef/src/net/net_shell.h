#pragma once
// L'axe réseau dans l'app : schémas `tentacle://art` (et suivants) et commandes de
// `window.tentacle` qu'il sert. Depuis `src/app/modules.cpp`, sur le fil principal, après
// `pont::install` (le registre existe) et AVANT `pont::installShim` (capabilities figées).

namespace tentacle {
struct AppContext;
}

namespace tentacle::net::jellyfin {
class Relay;
}
namespace tentacle::net::cf {
class PluginManifests;
}

namespace tentacle::reseau {

void install(AppContext& ctx);
void shutdown();

/// Les relais Jellyfin (adieu à la sortie, axe systeme : `setSessionObserver`, `postStop`) ;
/// nul avant `install`.
net::jellyfin::Relay* jellyfinRelay();
/// Les manifestes des requêtes déléguées lus sur le serveur (les `mediaHosts` des flux directs
/// d'Octave, axe medias) ; nul avant `install`. Fil principal.
net::cf::PluginManifests* pluginManifests();

}  // namespace tentacle::reseau
