#pragma once
// L'axe réseau dans l'app : schémas `tentacle://art` (et suivants) et commandes de
// `window.tentacle` qu'il sert. Depuis `src/app/modules.cpp`, sur le fil principal, après
// `pont::install` (le registre existe) et AVANT `pont::installShim` (capabilities figées).

#include <functional>
#include <optional>
#include <string>

#include "net/client_fetch_run.h"
#include "net/direct_relay.h"

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

// ---- Flux directs d'Octave (axe medias : `audio_play`, `audio_set_next`) -------------------
/// `adoptDirect` d'Electron (`directSources.ts`) : la source `{url, origin, direct?, …}` d'un titre
/// (`trackKey` : `ext:<extension>:<id>`), la session du moteur (`audio_engine_start` :
/// serverOrigin + en-têtes). `done` (fil principal) reçoit la source SANS `direct`, `url` = l'adresse
/// du relais local (`http://127.0.0.1:<port>/d/<jeton>`) quand le direct est adopté.
void adoptDirectSource(net::cf::Json source, const std::string& trackKey,
                       std::optional<net::cf::ServerSession> session,
                       std::function<void(net::cf::Json source, bool adopted)> done);
/// Un flux direct coupé en pleine lecture (`directRelay.onCut`) : le moteur relit le titre à la
/// position (`engine.sourceCut(url)`). Rappel sur le fil principal.
void setDirectCutListener(std::function<void(const std::string& localUrl)> onCut);
/// `http://127.0.0.1:<port>` (le moteur l'accepte comme origine de source) ; ouvre l'écoute.
std::string directRelayOrigin();
net::direct::Stats directRelayStats();

}  // namespace tentacle::reseau
