#pragma once
// Le hors ligne dans l'app CEF : session et avatars, titres gardés (films, épisodes,
// musique), lecture locale, `tentacle://local` — sur la base et les dossiers d'Electron.
//
// Depuis `src/app/modules.cpp`, sur le fil principal, avant la création du navigateur et
// AVANT `pont::installShim` (les commandes entrent dans `capabilities`) :
//   tentacle::offline::installInShell(pont::registry(), ctx);
// et dans `shutdownModules()` : `tentacle::offline::shutdown();`.

namespace bridge {
class Registry;
}

namespace tentacle {
struct AppContext;
}

namespace tentacle::offline {

void installInShell(bridge::Registry& registry, const AppContext& ctx);
/// Fil principal, à l'extinction : base refermée, fil hors ligne joint.
void shutdown();

}  // namespace tentacle::offline
