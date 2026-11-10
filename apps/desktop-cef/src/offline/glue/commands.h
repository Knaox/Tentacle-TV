#pragma once
// Déclarer une commande de `window.tentacle` exécutée sur le fil hors ligne.
//
// Comme le registre d'Electron (`ipc/registry.ts`) : la charge est validée AVANT toute
// exécution (`core/args.h`), et un échec est journalisé ici — le seul point de passage —
// puis rendu à la page, dont le `catch` lit le message (`readRootError` cherche son code
// n'importe où dedans : `root-not-empty`, `root-not-writable: <cause>`).

#include <functional>
#include <string>

#include <nlohmann/json.hpp>

#include "ports.h"  // bridge::Reply

namespace bridge {
class Registry;
}

namespace tentacle::offline {

using Json = nlohmann::json;

/// Exécutée sur le fil hors ligne ; la valeur rendue part à la page (`null` = `undefined`).
using SyncRun = std::function<Json(const Json& payload)>;
/// Pour une réponse différée (un transfert à attendre) : `reply` une seule fois, de n'importe
/// quel fil. Une exception levée avant la réponse la remplace.
using AsyncRun = std::function<void(const Json& payload, bridge::Reply reply)>;

void addCommand(bridge::Registry& registry, const std::string& name, SyncRun run);
void addAsyncCommand(bridge::Registry& registry, const std::string& name, AsyncRun run);

/// Journalise puis rend l'échec d'une commande (code `invalid_args` ou `error`).
void failCommand(const std::string& name, const bridge::Reply& reply, const std::exception& error);

}  // namespace tentacle::offline
