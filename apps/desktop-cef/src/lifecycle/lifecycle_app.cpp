// Le cycle de vie dans la boucle de l'app : le déroulé de sortie (exit_flow.h) relié à SDL3,
// au Shell, au lecteur du pont, aux transferts (hub) et à l'OS (lifecycle_platform.h).

#include "lifecycle/lifecycle_app.h"

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <string>
#include <vector>

#include "app/args.h"
#include "include/cef_app.h"
#include "lifecycle/app_links.h"
#include "lifecycle/drag_hit_test.h"
#include "lifecycle/exit_flow.h"
#include "lifecycle/hub.h"
#include "lifecycle/lifecycle_app_internal.h"
#include "lifecycle/lifecycle_platform.h"
#include "lifecycle/lifecycle_shell.h"
#include "lifecycle/texts.h"
#include "shell/browser_app.h"
#include "shell/main_thread.h"
#include "shell/shell.h"

namespace tentacle::lifecycle::app {
namespace {

struct State {
  std::vector<std::string> argv;  // ligne de commande d'origine (sans --relaunch-after)
  Shell* shell = nullptr;
  SDL_Window* window = nullptr;
  std::unique_ptr<ExitFlow> flow;
  bool finished = false;
  bool browserGone = false;
  uint32_t wakeEvent = 0;
};

State& st() {
  static State s;
  return s;
}

void wakeLoop() {
  if (!st().wakeEvent) return;
  SDL_Event e{};
  e.type = st().wakeEvent;
  SDL_PushEvent(&e);
}

void after(int64_t ms, std::function<void()> fn) {
  if (ms <= 0) postToMain(std::move(fn));
  else postToMainDelayed(std::move(fn), ms);
}

// Minuteur répété sur le fil principal (tâches CEF) ; la fonction rendue l'arrête.
std::function<void()> every(int64_t ms, std::function<void()> tick) {
  auto alive = std::make_shared<bool>(true);
  auto step = std::make_shared<std::function<void()>>();
  std::weak_ptr<std::function<void()>> weak = step;
  *step = [alive, tick = std::move(tick), weak, ms] {
    if (!*alive) return;
    tick();
    if (auto again = weak.lock(); again && *alive) postToMainDelayed(*again, ms);
  };
  postToMainDelayed(*step, ms);
  return [alive, step] { *alive = false; };
}

ExitPorts ports() {
  const bool french = platform::systemLocaleIsFrench();
  return ExitPorts{
      [] { SDL_HideWindow(st().window); },
      [] {
        if (st().shell) st().shell->requestClose();
      },
      [] { platform::focusWindow(st().window); },
      [] { return videoControls().running && videoControls().running(); },
      [](std::function<void()> done) {
        if (videoControls().stop) videoControls().stop(std::move(done));
        else done();
      },
      [] {
        if (videoControls().pause) videoControls().pause();
      },
      hub::transfersInFlight,
      hub::transfersBusy,
      hub::backgroundEnabled,
      [french](int n, std::function<void(bool)> answer) {
        platform::askQuit(st().window, quitTexts(n, french), std::move(answer));
      },
      [french](int n) {
        const auto t = backgroundTransfersText(n, french);
        platform::notify(t.title, t.body);
      },
      hub::fireWindowClosed,
      [](std::function<void()> done) {
        hub::farewell().farewell(hub::sendFarewellStop, kFarewellDeadlineMs, after, std::move(done));
      },
      [] {
        if (!platform::spawnSuccessor(st().argv)) std::fprintf(stderr, "[cycle] relance impossible\n");
      },
      [] {
        st().finished = true;
        wakeLoop();
      },
      [] { return int64_t(SDL_GetTicks()); },
      after,
      every,
  };
}

bool draining() { return st().flow && st().flow->phase() == ExitFlow::Phase::Draining; }

}  // namespace

Shell* shell() { return st().shell; }

void requestRelaunch() {
  if (st().flow) st().flow->requestRelaunch();
}

void onSecondInstance(const std::vector<std::string>& argv) {
  // `claimSingleInstance` : le lien d'abord ; sans fenêtre (transferts sans elle), on relance.
  if (auto link = appLinkFromArgv(argv)) deliverAppLink(*link);
  if (draining()) st().flow->reopen();
  else platform::focusWindow(st().window);
}

void beforeSdl(int argc, char** argv, const AppOptions& opts) {
  for (int i = 0; i < argc; ++i) {
    const std::string a = argv[i];
    if (a.rfind("--relaunch-after", 0) == 0) {
      if (a == "--relaunch-after") ++i;  // forme « --clé valeur »
      continue;
    }
    st().argv.push_back(a);
  }
  // Instance relancée : l'ancienne doit être sortie, sinon le verrou d'instance unique de CEF
  // nous renverrait vers elle (`app.relaunch` d'Electron attend de même).
  if (auto it = opts.extra.find("relaunch-after"); it != opts.extra.end()) {
    const long pid = std::strtol(it->second.c_str(), nullptr, 10);
    if (pid > 0) platform::waitForProcessExit(pid, 15'000);
  }
  platform::setNoActivation(opts.background);  // bancs : jamais voler le focus
  keepLaunchLink(argc, argv);
  platform::installSystemEvents(
      [](const std::string& url) {
        // `open-url` : sans fenêtre (file finie en arrière-plan), la page rouverte le prendra.
        if (deliverAppLink(url) && draining()) st().flow->reopen();
      },
      [] {
        if (st().flow) st().flow->reopen();
      });
  setSecondInstanceHandler(onSecondInstance);
  // Fermer la dernière fenêtre n'est PAS quitter : la croix passe par la garde de sortie, et
  // peut laisser les transferts finir sans fenêtre (SDL enverrait sinon SDL_EVENT_QUIT).
  SDL_SetHint(SDL_HINT_QUIT_ON_LAST_WINDOW_CLOSE, "0");
}

void prepareWindow(SDL_Window* window) {
  st().window = window;
  // `window.ts` : 1280×800 (taille de départ, --size), minimum 900×600, aucune mémorisation.
  SDL_SetWindowMinimumSize(window, 900, 600);
  platform::prepareMainWindow(window);
  installDragHitTest(window);
}

bool handedToRunningInstance() { return CefGetExitCode() == CEF_RESULT_CODE_NORMAL_EXIT_PROCESS_NOTIFIED; }

void attach(Shell* shell, SDL_Window* window) {
  st().shell = shell;
  st().window = window;
  st().wakeEvent = SDL_RegisterEvents(1);
  st().flow = std::make_unique<ExitFlow>(ports());
}

bool handleEvent(const SDL_Event& e) {
  if (st().wakeEvent && e.type == st().wakeEvent) return true;
  if (!st().flow) return false;
  if (e.type == SDL_EVENT_QUIT) {
    st().flow->requestQuit();
    return true;
  }
  if (e.type == SDL_EVENT_WINDOW_CLOSE_REQUESTED) {
    st().flow->requestClose();
    return true;
  }
  return false;
}

bool windowAlive() { return !st().flow || st().flow->phase() == ExitFlow::Phase::Running; }

void afterEvents() {
  if (st().browserGone || !st().shell || !st().shell->isClosed() || !st().flow) return;
  st().browserGone = true;
  st().flow->browserClosed();
}

int waitTimeoutMs() {
  // Le navigateur se ferme dans la pompe de CEF, sans évènement SDL : on relit son état.
  return st().flow && st().flow->phase() == ExitFlow::Phase::Closing ? 20 : -1;
}

bool running() { return !st().finished; }

void afterShutdown() { hub::releaseWakeLocks(); }

}  // namespace tentacle::lifecycle::app
