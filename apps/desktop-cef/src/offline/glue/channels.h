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

}  // namespace tentacle::offline
