// Diagnostic des bancs du cycle de vie, avec `--debug-lifecycle` seulement (jamais hors banc) :
// canaux `lifecycle.debug.*` de `__shell.invoke`, hors de `window.tentacle`.
//
//   state                         → phase du déroulé, régions déplaçables, verdict de points
//   transfers {inFlight,busy,background,emptyAfterMs?} → remplace le moteur (avant l'intégration
//                                 de horsligne) ; la file se vide d'elle-même après emptyAfterMs
//   close {kind: "close"|"quit"}  → l'évènement SDL de la croix ou de Cmd+Q
//   focus {focused}               → l'évènement SDL de focus (la chaîne jusqu'à la page)
//   note {path, body, baseUrl…}   → un report de lecture, comme le relais jellyfin_session_post
//   sheet {end?: number}          → la feuille native ouverte (boîte, sélecteur) ; la ferme
// Sans émetteur de l'axe reseau, l'adieu est journalisé au lieu d'être posté.

#include <SDL3/SDL.h>

#include <cstdio>

#include "lifecycle/drag_hit_test.h"
#include "lifecycle/hub.h"
#include "lifecycle/lifecycle.h"
#include "lifecycle/lifecycle_debug.h"
#include "lifecycle/lifecycle_platform.h"
#include "shell/ipc.h"
#include "shell/main_thread.h"

namespace tentacle::lifecycle {
namespace {

struct FakeTransfers {
  int inFlight = 0;
  bool busy = false;
  bool background = true;
};
FakeTransfers g_fake;

void pushWindowEvent(SDL_Window* window, SDL_EventType type) {
  SDL_Event e{};
  e.type = type;
  e.window.windowID = SDL_GetWindowID(window);
  SDL_PushEvent(&e);
}

}  // namespace

void installDebugChannels(SDL_Window* window, std::function<std::string()> phase) {
  ipc::registerHandler("lifecycle.debug.state", [window, phase](const Json& p, ipc::Responder r) {
    Json regions = Json::array();
    for (const auto& g : dragRegions()) regions.push_back({g.x, g.y, g.width, g.height, g.draggable});
    Json verdicts = Json::array();
    if (p.is_object() && p.contains("points")) {
      for (const auto& pt : p["points"]) verdicts.push_back(isDraggable(dragRegions(), pt[0], pt[1]));
    }
    r.reply({{"phase", phase()}, {"regions", regions}, {"draggable", verdicts},
             {"window", Json::parse(platform::windowDebug(window), nullptr, false)}});
  });
  ipc::registerHandler("lifecycle.debug.transfers", [](const Json& p, ipc::Responder r) {
    g_fake = {p.value("inFlight", 0), p.value("busy", false), p.value("background", true)};
    setTransfersProbe({[] { return g_fake.inFlight; }, [] { return g_fake.busy; },
                       [] { return g_fake.background; }});
    if (const int ms = p.value("emptyAfterMs", 0); ms > 0) {
      postToMainDelayed([] { g_fake.inFlight = 0; }, ms);
    }
    r.reply();
  });
  ipc::registerHandler("lifecycle.debug.close", [window](const Json& p, ipc::Responder r) {
    r.reply();
    if (p.value("kind", "close") == "quit") {
      SDL_Event e{};
      e.type = SDL_EVENT_QUIT;
      SDL_PushEvent(&e);
    } else {
      pushWindowEvent(window, SDL_EVENT_WINDOW_CLOSE_REQUESTED);
    }
  });
  ipc::registerHandler("lifecycle.debug.focus", [window](const Json& p, ipc::Responder r) {
    pushWindowEvent(window, p.value("focused", false) ? SDL_EVENT_WINDOW_FOCUS_GAINED : SDL_EVENT_WINDOW_FOCUS_LOST);
    r.reply();
  });
  ipc::registerHandler("lifecycle.debug.note", [](const Json& p, ipc::Responder r) {
    noteSessionPost({p.value("baseUrl", ""), p.value("path", ""), p.value("token", ""),
                     p.value("authHeader", ""), p.value("body", "")});
    r.reply(hub::farewell().pending());
  });
  ipc::registerHandler("lifecycle.debug.sheet", [window](const Json& p, ipc::Responder r) {
    const int end = p.is_object() && p.contains("end") ? p["end"].get<int>() : -1;
    r.reply(Json::parse(platform::sheetDebug(window, end), nullptr, false));
  });
  // L'adieu sans l'axe reseau : journalisé, rendu au bout de 50 ms (un aller-retour local). Avec
  // son relais branché, c'est lui qui poste — jamais remplacé par le banc.
  if (!hub::hasFarewellSender()) setFarewellSender([](const FarewellStop& stop, std::function<void()> done) {
    std::fprintf(stderr, "[cycle] adieu (banc) : POST %s/Sessions/Playing/Stopped %s\n", stop.baseUrl.c_str(),
                 stop.body.c_str());
    postToMainDelayed(std::move(done), 50);
  });
  std::fprintf(stderr, "[cycle] canaux de diagnostic lifecycle.debug.* ouverts (--debug-lifecycle)\n");
}

}  // namespace tentacle::lifecycle
