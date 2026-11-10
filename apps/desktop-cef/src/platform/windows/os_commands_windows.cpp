// Windows : les commandes que la coquille Electron ne déclare que sous Windows
// (`ipc/updates.ts`) — la mise à jour du paquet MSIX par le Microsoft Store :
//   check_msix_update {}                  → { version: "", mandatory } | null
//   download_and_install_msix_update {}   → null, ou rejet (code lisible, voir msix_rule.h)
//   évènement msix-update-progress        { progress, indeterminate }
// Les déclarer fait passer `supportsAppUpdates()` à vrai côté page : la bannière « Mettre à
// jour » apparaît quand le Store a une mise à jour. Hors paquet installé (pnpm dev:cef), la
// recherche répond null : rien ne s'affiche.

#include <windows.h>
#include <shellapi.h>

#include <atomic>
#include <cstdio>
#include <thread>

#include "app/app.h"
#include "display/display_channels.h"
#include "display/msix_rule.h"
#include "platform/windows/msix_update_windows.h"
#include "registry.h"
#include "shell/main_thread.h"

namespace tentacle::platform {
namespace {

// Page des mises à jour du Store : le repli qui fonctionne toujours.
constexpr wchar_t kUpdatesPage[] = L"ms-windows-store://downloadsandupdates";

bridge::Registry* g_registry = nullptr;
HWND g_owner = nullptr;
std::atomic<bool> g_installing{false};

void checkUpdate(const bridge::Json&, bridge::Reply reply) {
  std::thread([reply] {
    // Une recherche qui échoue n'est pas une mise à jour absente, mais la page ne peut rien
    // en faire d'autre : elle n'affiche rien (Electron : null).
    const auto info = win::msix::check();
    if (!info) return reply.ok(nullptr);
    reply.ok(bridge::Json{{"version", ""}, {"mandatory", info->mandatory}});
  }).detach();
}

void installUpdate(const bridge::Json&, bridge::Reply reply) {
  if (!g_owner) return reply.fail("msix", "aucune fenetre pour la boite de dialogue du Store");
  if (g_installing.exchange(true)) return reply.fail("msix", "install-in-progress");
  // La progression réelle demanderait un délégué WinRT ; le Store affiche la sienne. On le dit
  // à la page (barre indéterminée), comme Electron.
  if (g_registry) g_registry->emit("msix-update-progress", {{"progress", 0}, {"indeterminate", true}});
  std::thread([reply] {
    const std::string code = win::msix::downloadAndInstall(g_owner);
    g_installing = false;
    if (code.empty()) {
      postToMain([] {
        if (g_registry) g_registry->emit("msix-update-progress", {{"progress", 1}, {"indeterminate", false}});
      });
      return reply.ok(nullptr);
    }
    // Refus, batterie faible, Wi-Fi exigé : l'utilisateur peut agir, la page le lui dit.
    if (!display::opensStorePage(code)) {
      std::fprintf(stderr, "[maj] installation non aboutie (%s)\n", code.c_str());
      return reply.fail("msix", code);
    }
    // Sinon, la page de mises à jour du Store : l'utilisateur obtient sa mise à jour ; on
    // rejette quand même, la page ne doit PAS enchaîner sur un redémarrage.
    std::fprintf(stderr, "[maj] installation directe impossible (%s), ouverture du Store\n", code.c_str());
    postToMain([] { ShellExecuteW(nullptr, L"open", kUpdatesPage, nullptr, nullptr, SW_SHOWNORMAL); });
    reply.fail("msix", "store-page-opened");
  }).detach();
}

}  // namespace

void installOsCommands(AppContext& ctx, bridge::Registry& registry) {
  g_registry = &registry;
  g_owner = static_cast<HWND>(ctx.nativeWindow);
  registry.event("msix-update-progress");
  registry.command("check_msix_update", checkUpdate);
  registry.command("download_and_install_msix_update", installUpdate);
}

void shutdownOsCommands() { g_registry = nullptr; }

}  // namespace tentacle::platform
