// Le pont dans le proto : la colle entre `src/bridge` (logique, testée seule) et le
// socle (IPC, fenêtre SDL3, compositeur) + le lecteur de vidéo-HDR.
//
// Depuis `src/app/modules.cpp`, sur le fil principal, avant la création du navigateur :
//   tentacle::pont::install(ctx);                 // registre + canaux vidéo/fenêtre
//   tentacle::music::installInShell(pont::registry());  // octave déclare ses canaux
//   tentacle::pont::setOnVideoClaim([] { tentacle::music::videoClaim(); });
//   tentacle::pont::installShim(ctx);             // EN DERNIER : capabilities figées
#pragma once

#include <functional>

#include <nlohmann/json.hpp>

namespace bridge {
class Registry;
}

namespace tentacle {
struct AppContext;
class Player;
}

namespace tentacle::pont {

void install(AppContext& ctx);
/// Le registre commun (`window.tentacle`), valable entre `install` et `shutdown`.
bridge::Registry& registry();
/// Une vidéo démarre : appelé à chaque `mpv_init` (octave y met la musique en pause).
void setOnVideoClaim(std::function<void()> claim);
/// Pose le shim (`registerInjectedScript`) avec la liste FINALE des canaux.
void installShim(AppContext& ctx);
void shutdown();

// Le lecteur vidéo vu du cycle de vie (axe systeme, src/lifecycle) : fermer la fenêtre l'arrête,
// l'adieu à Jellyfin le met en pause pendant qu'il poste.
bool videoRunning();
void stopVideo(std::function<void()> done);
/// `pause=yes`, écriture ASYNCHRONE (jamais de propriété mpv en synchrone).
void pauseVideo();

// Le verre natif (axe verre, src/glass).
/// La configuration de `window.tentacle.liquidGlass` (`{refractsVideo}`), à poser AVANT
/// `installShim` ; `null` (défaut) : pas de pont du verre — l'option de Réglages est absente.
void setLiquidGlassShim(const nlohmann::json& config);
/// La page laisse voir la vidéo (vraie couche posée : vrai) ou plus (fin de lecture, ou
/// `player_surface_transparent {on: false}` de la page : faux). Un seul abonné.
void setOnSurfaceTransparent(std::function<void(bool)> listener);
/// Le lecteur de la lecture en cours (nullptr sans elle) — à utiliser tout de suite, sur le fil
/// principal : l'instance peut s'arrêter au tour suivant.
tentacle::Player* videoPlayer();

}  // namespace tentacle::pont
