#include "pip/glue/pip_commands.h"

#include <cstdio>

#include "pip/pip_controller.h"
#include "pip/rules/pip_payload.h"
#include "registry.h"

namespace tentacle::pip {
namespace {

using bridge::Reply;

// La page reçoit une `Error(message)` (le shim fait d'un rejet `{code, message}` une Error).
void refuse(Reply& reply, const std::string& message) {
  std::fprintf(stderr, "[pip] %s\n", message.c_str());
  reply.fail("bad_args", message);
}

template <typename T>
const T* argsOf(const Parsed<T>& parsed, Reply& reply) {
  if (const auto* error = std::get_if<std::string>(&parsed)) {
    refuse(reply, *error);
    return nullptr;
  }
  return &std::get<T>(parsed);
}

}  // namespace

void registerCommands(bridge::Registry& registry, Controller& c) {
  registry.command("pip_open", [&c](const Json& p, Reply r) {
    const auto* a = argsOf(parseOpen(p), r);
    if (!a) return;
    const Frame f = c.arm(a->mode, a->width, a->height);
    r.ok(Json{{"shadow", f.shadow}, {"bezel", f.bezel}});
  });
  registry.command("pip_mode", [&c](const Json& p, Reply r) {
    const auto* a = argsOf(parseMode(p), r);
    if (!a) return;
    std::optional<Size> video;
    if (a->width && a->height) video = Size{double(*a->width), double(*a->height)};
    r.ok(c.setMode(a->mode, video));
  });
  registry.command("pip_resize", [&c](const Json& p, Reply r) {
    const auto* a = argsOf(parseResize(p), r);
    if (a) r.ok(c.resize(a->width, a->height));
  });
  registry.command("pip_gesture", [&c](const Json& p, Reply r) {
    const auto* a = argsOf(parseGesture(p), r);
    if (a) r.ok(c.setGesture(a->gesture, a->grab));
  });
  // Rend la main une fois l'image revenue à sa place dans le lecteur.
  registry.command("pip_restore", [&c](const Json& p, Reply r) {
    if (const auto error = checkEmpty("pip_restore", p)) return refuse(r, *error);
    c.restore([r](bool done) { r.ok(done); });
  });
  // La page ferme le PiP par ici : la vidéo revient avant que la fenêtre ne parte.
  registry.command("pip_close", [&c](const Json& p, Reply r) {
    if (const auto error = checkEmpty("pip_close", p)) return refuse(r, *error);
    r.ok(c.close());
  });
}

}  // namespace tentacle::pip
