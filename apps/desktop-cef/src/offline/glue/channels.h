#pragma once
// Les familles de commandes du hors ligne, déclarées dans le registre de `window.tentacle`.
// Chacune est le pendant d'un fichier `ipc/*.ts` d'Electron.

#include <cstdint>

namespace bridge {
class Registry;
}

namespace tentacle::offline {

/// L'heure murale, en millisecondes (`Date.now()`).
int64_t nowMs();

/// `session_cache_*`, `avatar_cache_*` (`ipc/session.ts`).
void registerSessionChannels(bridge::Registry& registry);
/// Racine, espace, « continuer en arrière-plan », base des ressources locales
/// (`ipc/downloadsStorage.ts`).
void registerStorageChannels(bridge::Registry& registry);
/// Source locale, progression, rapports, purge (`ipc/downloadsPlayback.ts`).
void registerPlaybackChannels(bridge::Registry& registry);
/// `downloads_list`, `downloads_state_for_item`, `downloads_set_auto_delete`.
void registerListChannels(bridge::Registry& registry);
/// `downloads_music_list`, `downloads_music_collections`.
void registerMusicListChannels(bridge::Registry& registry);

/// « Continuer en arrière-plan » (réglage de l'appareil, allumé par défaut). Fil hors ligne.
bool backgroundTransfersOn();

}  // namespace tentacle::offline
