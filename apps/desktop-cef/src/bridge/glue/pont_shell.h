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

}  // namespace tentacle::pont
