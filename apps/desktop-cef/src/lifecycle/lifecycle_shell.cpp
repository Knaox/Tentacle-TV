// Les canaux du cycle de vie : liens d'app, liens externes, sélecteur de dossier, relance,
// focus de la fenêtre (`appLinks.ts`, `ipc/shell.ts` → `registerShellCapabilities`,
// `windowFocus.ts` d'Electron).

#include "lifecycle/lifecycle_shell.h"

#include <SDL3/SDL.h>

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "app/app.h"
#include "lifecycle/app_links.h"
#include "lifecycle/external_url.h"
#include "shell/external_url.h"  // navigateur : URL canonique, mode banc
#include "lifecycle/lifecycle_app_internal.h"
#include "lifecycle/lifecycle_platform.h"
#include "registry.h"
#include "shell/ipc.h"
#include "shell/shell.h"

namespace tentacle::lifecycle {
namespace {

VideoControls g_video;
AppLinks g_links;
bridge::Registry* g_registry = nullptr;
SDL_Window* g_window = nullptr;
// La page du document courant a demandé `app_link_take` : elle écoute `app-link`
// (`useDesktopAppLinks` : la demande, puis l'écoute, au même tour). Remis à faux à chaque
// nouveau document (le shim le dit à sa pose).
bool g_pageListening = false;

// La page écoute-t-elle ? (`!webContents.isLoading()` d'Electron.) Sous CEF, « pas en
// chargement » est vrai AVANT la première navigation : un lien remis à ce moment se perdait
// (mesuré, lien du lancement). On attend donc que le document l'ait demandé.
bool pageReady() {
  Shell* shell = app::shell();
  if (!shell || shell->isClosed() || !g_pageListening) return false;
  auto browser = shell->browser();
  return browser && !browser->IsLoading();
}

AppLinkPage page() {
  return AppLinkPage{
      pageReady,
      [](const std::string& link) {
        if (g_registry) g_registry->emit(kAppLinkEvent, link);
      },
      [] {
        if (g_window) platform::focusWindow(g_window);
      },
  };
}

bool windowFocused() {
  return g_window && (SDL_GetWindowFlags(g_window) & SDL_WINDOW_INPUT_FOCUS) != 0;
}

// Le focus de la fenêtre, donné à la page (macOS seulement, comme Electron) : la page ternit la
// fenêtre inactive à la façon du système, et `document.hasFocus()` ment.
bool onFocusEvent(void*, SDL_Event* e) {
  if (e->type == SDL_EVENT_WINDOW_FOCUS_GAINED || e->type == SDL_EVENT_WINDOW_FOCUS_LOST) {
    ipc::emit("lifecycle.windowFocus", e->type == SDL_EVENT_WINDOW_FOCUS_GAINED);
  }
  return true;
}

}  // namespace

void setVideoControls(VideoControls controls) { g_video = std::move(controls); }
const VideoControls& videoControls() { return g_video; }

bool deliverAppLink(const std::string& raw) { return g_links.deliver(raw, page()); }

void keepLaunchLink(int argc, char** argv) {
  g_links.keepLaunchLink(std::vector<std::string>(argv, argv + argc));
}

bool openExternalSafely(const std::string& url) {
  if (!externalUrlAllowed(url)) return false;
  // Par l'ouverture de l'axe navigateur (même liste, URL rendue canonique) : elle seule tient
  // le mode banc (`TENTACLE_OPEN_EXTERNAL=log`), qui journalise sans ouvrir chez l'utilisateur.
  return tentacle::openExternalSafely(url);
}

void install(AppContext& ctx, bridge::Registry& registry) {
  g_registry = &registry;
  g_window = ctx.window;
  // Panneau « À propos » (`applySystemIdentity`) : le nom et la version de l'app.
  std::string version = "1.42.0";  // celle du front servi par le banc, comme le pont
  if (auto it = ctx.options->extra.find("app-version"); it != ctx.options->extra.end() && !it->second.empty()) {
    version = it->second;
  }
  platform::setAboutPanel("Tentacle TV", version);

  // Liens `tentacle://octave/…` : le lien du lancement attend que la page le demande.
  registry.event(kAppLinkEvent);
  registry.command("app_link_take", [](const bridge::Json&, bridge::Reply reply) {
    g_pageListening = true;
    auto link = g_links.take();
    if (std::getenv("TENTACLE_LIFECYCLE_TRACE")) {
      std::fprintf(stderr, "[cycle] app_link_take → %s\n", link ? link->c_str() : "(rien)");
    }
    reply.ok(link ? bridge::Json(*link) : bridge::Json(nullptr));
  });

  // Capacités de la coquille, hors liste (`registerShellCapabilities`). Le portier des liens
  // externes vit ici, jamais dans la page : une liste blanche dans la page ne protège de rien.
  ipc::registerHandler("tentacle:open-external", [](const Json& payload, ipc::Responder r) {
    const std::string url = payload.is_object() ? payload.value("url", "") : std::string();
    if (!openExternalSafely(url)) std::fprintf(stderr, "[cycle] lien externe refusé\n");
    r.reply();  // Electron rend `undefined` dans tous les cas
  });
  ipc::registerHandler("tentacle:pick-folder", [](const Json&, ipc::Responder r) {
    if (!g_window) return r.reply();
    platform::pickFolder(g_window, [r](std::optional<std::string> path) {
      r.reply(path ? Json(*path) : Json(nullptr));
    });
  });
  ipc::registerHandler("tentacle:relaunch", [](const Json&, ipc::Responder r) {
    r.reply();
    app::requestRelaunch();
  });

  ipc::registerHandler("lifecycle.pageStarted", [](const Json&, ipc::Responder r) {
    g_pageListening = false;
    r.reply();
  });
  // Diagnostic des bancs, hors `window.tentacle` : la fenêtre telle qu'AppKit la voit.
  ipc::registerHandler("lifecycle.debug.window", [](const Json&, ipc::Responder r) {
    r.reply(Json::parse(platform::windowDebug(g_window), nullptr, false));
  });
  ipc::registerHandler("lifecycle.windowFocus.get", [](const Json&, ipc::Responder r) { r.reply(windowFocused()); });
  if (platform::hasWindowFocusBridge()) SDL_AddEventWatch(onFocusEvent, nullptr);
}

}  // namespace tentacle::lifecycle
