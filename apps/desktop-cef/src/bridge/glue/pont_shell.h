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

namespace bridge {
class Registry;
}

namespace tentacle {
struct AppContext;
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

}  // namespace tentacle::pont
