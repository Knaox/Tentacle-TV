#include "offline/glue/commands.h"

#include <cstdio>
#include <exception>
#include <memory>

#include "offline/core/args.h"
#include "offline/glue/offline_thread.h"
#include "registry.h"

namespace tentacle::offline {

void failCommand(const std::string& name, const bridge::Reply& reply, const std::exception& error) {
  const bool invalid = dynamic_cast<const args::Invalid*>(&error) != nullptr;
  const std::string message = invalid ? "arguments invalides pour " + name + ": " + error.what() : error.what();
  // Le motif d'un refus n'allait nulle part côté page (chaque appel y est enveloppé dans un
  // `catch` silencieux) : il est dit ici. Aucune charge n'est recopiée — elle peut porter
  // un jeton.
  std::fprintf(stderr, "[ipc] %s a echoue : %s\n", name.c_str(), message.c_str());
  reply.fail(invalid ? "invalid_args" : "error", message);
}

void addCommand(bridge::Registry& registry, const std::string& name, SyncRun run) {
  addAsyncCommand(registry, name, [run = std::move(run)](const Json& payload, bridge::Reply reply) {
    reply.ok(run(payload));
  });
}

void addAsyncCommand(bridge::Registry& registry, const std::string& name, AsyncRun run) {
  auto shared = std::make_shared<AsyncRun>(std::move(run));
  registry.command(name, [name, shared](const Json& payload, bridge::Reply reply) {
    // La page envoie `args ?? {}` : une charge absente vaut un objet vide.
    Json body = payload.is_null() ? Json::object() : payload;
    thread::post([name, shared, body = std::move(body), reply]() {
      try {
        (*shared)(body, reply);
      } catch (const std::exception& error) {
        failCommand(name, reply, error);
      }
    });
  });
}

}  // namespace tentacle::offline
