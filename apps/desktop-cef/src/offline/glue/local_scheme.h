#pragma once
// tentacle://local : les ressources des titres gardés (voir `local_scheme.cpp`).

namespace tentacle::offline {

/// Processus principal, après `CefInitialize` (le schéma `tentacle` est déjà déclaré par le
/// socle dans tous les processus).
void serveLocalScheme();

}  // namespace tentacle::offline
