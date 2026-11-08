// Octave — la colle avec le reste du proto : les canaux `audio_*` déclarés
// dans le registre commun du pont (`bridge::Registry`, qui pose le préfixe
// `tentacle:` et en fait `window.tentacle.capabilities`), et le fil principal
// du socle (`shell/main_thread.h`). Compilé seulement quand ces deux cibles
// existent (voir `CMakeLists.txt`).
#pragma once

namespace bridge {
class Registry;
}

namespace tentacle::music {

// Depuis `src/app/modules.cpp`, sur le fil principal, AVANT `injectedScript()`.
void installInShell(bridge::Registry& registry);

// Une lecture VIDÉO démarre (`VideoChannels::setOnVideoClaim` du pont, à chaque
// `mpv_init`) : la musique qui joue passe en pause. Rend vrai si elle jouait.
bool videoClaim();

// À la fermeture : la musique s'arrête et la sortie audio est rendue.
void shutdownMusic();

}  // namespace tentacle::music
