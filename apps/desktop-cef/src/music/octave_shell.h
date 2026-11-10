// Octave — la colle avec le reste du proto : les canaux `audio_*` déclarés
// dans le registre commun du pont (`bridge::Registry`, qui pose le préfixe
// `tentacle:` et en fait `window.tentacle.capabilities`), et le fil principal
// du socle (`shell/main_thread.h`). Compilé seulement quand ces deux cibles
// existent (voir `CMakeLists.txt`).
#pragma once

#include <functional>
#include <string>

#include <nlohmann/json.hpp>

#include "music/octave_channels.h"

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

// « À l'écoute » (medias) : chaque commande reçue de la page (`audio_*`, charge telle quelle)
// et chaque évènement `audio://event` émis, sur le fil principal.
using CallObserver = std::function<void(const std::string& channel, const nlohmann::json& args)>;
using EventObserver = std::function<void(const nlohmann::json& event)>;
void observeMusic(CallObserver onCall, EventObserver onEvent);
// Une commande du SYSTÈME pour la musique : la page la reçoit en `{type:"remote", command}`
// (play|pause|next|previous|stop) — la file et l'intention « lecture » sont à elle.
void remoteCommand(const std::string& command);
// Un saut demandé par le système (barre du Centre de contrôle) : « la position, la coquille
// l'applique seule » (contrat du pont) ; la page l'apprend par l'état suivant.
void seekFromSystem(double positionMs);

// --- Coutures pour les autres axes (à appeler après `installInShell`) -------------------
// Hors ligne (horsligne) : le fichier de la copie gardée d'un titre (`audioKept.ts`).
void setKeptLookup(KeptLookup lookup);
// Requêtes déléguées (reseau) : adopter le flux direct d'une source (`directSources.ts`).
void setDirectAdopter(DirectAdopter adopter);
// Le relais local dit un flux direct coupé en pleine lecture (`directRelay.onCut`).
void sourceCut(const std::string& url);
// La fenêtre fermée pour de bon (l'app reste pour finir un transfert) : la musique s'arrête
// (`stopAudio` d'Electron, `window.on("closed")` et `backgroundDrain`).
void stopAudio();

}  // namespace tentacle::music
