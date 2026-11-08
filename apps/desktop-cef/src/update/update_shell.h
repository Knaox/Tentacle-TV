// Mise à jour automatique dans le proto : la colle entre le moteur (src/update, testé seul)
// et le socle (IPC, fil principal, sortie de l'app). Depuis src/app/modules.cpp :
//   tentacle::maj::install(ctx);   // à la fin de initModules (après le shim du pont)
//   tentacle::maj::shutdown();     // au début de shutdownModules
//
// Options (`--clé=valeur`) : update-feed, update-channel, update-state-dir,
// update-first-check-ms, update-retry-ms (banc). Environnement : TENTACLE_UPDATE_FEED, et pour le banc seulement
// TENTACLE_UPDATE_TEST_PUBKEY (acceptée UNIQUEMENT avec un flux sur 127.0.0.1).
#pragma once

namespace tentacle {
struct AppContext;
}

namespace tentacle::maj {

void install(AppContext& ctx);
// Fermeture : une mise à jour prête (mineure, ou remise à plus tard) s'applique sans bruit.
void shutdown();

}  // namespace tentacle::maj
