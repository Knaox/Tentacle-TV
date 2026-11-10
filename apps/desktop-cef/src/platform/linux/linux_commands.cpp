// Les commandes propres à Linux de `window.tentacle` (apps/desktop-electron/src/main/ipc/
// linuxSession.ts) : déclarées sous Linux SEULEMENT — les capacités valent porte
// (`supportsLinuxSession()` du front), le réglage disparaît de lui-même ailleurs.
//
//   linux_session_get {} → { choice, montage, bureau } : le choix enregistré PENDANT CE
//     lancement (figé au démarrage), le montage pris, ce que le bureau annonce ;
//   linux_session_set { choice: "auto"|"wayland"|"x11" } → null : écrit le fichier, effet à
//     la relance (`relaunch()`, que la page demande — axe systeme).

#include <cstdio>
#include <filesystem>
#include <fstream>

#include "bridge/registry.h"
#include "platform/linux/edid_linux.h"
#include "platform/linux/graphics_session.h"
#include "platform/linux/linux_commands.h"
#include "shell/paths.h"

namespace tentacle::platform {

void installLinuxCommands(bridge::Registry& registry) {
  std::fprintf(stderr, "[session] écran HDR branché (EDID) : %s\n", hdrDisplayConnected() ? "oui" : "non");
  installClipboardBridge();
  registry.command("linux_session_get", [](const bridge::Json&, bridge::Reply reply) {
    const DecidedSession& d = startupSession();
    reply.ok({{"choice", sessionChoiceName(d.choice)},
              {"montage", displayServerName(d.montage)},
              {"bureau", displayServerName(d.desktop)}});
  });
  registry.command("linux_session_set", [](const bridge::Json& p, bridge::Reply reply) {
    const auto* choice = p.contains("choice") && p["choice"].is_string() ? &p["choice"] : nullptr;
    const auto parsed = choice ? parseSessionChoice(choice->get<std::string>()) : std::nullopt;
    if (!parsed) return reply.fail("bad_payload", "choice : auto, wayland ou x11");
    const auto folder = paths::userData();
    std::error_code ec;
    std::filesystem::create_directories(folder, ec);
    std::ofstream out(folder / kSessionFile, std::ios::trunc);
    out << sessionFileContent(*parsed);
    if (!out) return reply.fail("io", "session-graphique.json illisible en écriture");
    reply.ok(nullptr);
  });
}

}  // namespace tentacle::platform
