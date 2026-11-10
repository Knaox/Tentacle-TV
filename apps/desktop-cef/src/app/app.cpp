// Boucle principale. Qui possède quoi :
//   - SDL3 possède la fenêtre et la boucle d'évènements (SDL_WaitEvent) ;
//   - CEF tourne en external_message_pump sur le fil principal ; sa pompe (MessagePump)
//     s'exécute dans la run loop de l'OS, y compris pendant les boucles modales ;
//   - le compositeur possède l'empilement des couches dans la fenêtre.

#include "app/app.h"

#include <cstdio>
#include <filesystem>
#include <memory>
#include <string_view>

#include "app/platform_app.h"
#include "include/cef_app.h"
#include "lifecycle/lifecycle_app.h"
#include "shell/app_scheme.h"
#include "shell/browser_app.h"
#include "shell/builtin_handlers.h"
#include "shell/message_pump.h"
#include "shell/paths.h"
#include "shell/shell.h"

namespace tentacle {
namespace {

bool onWindowEvent(void* userdata, SDL_Event* e) {
  // Appelé au moment où SDL produit l'évènement — y compris pendant le redimensionnement
  // en direct, quand la boucle principale est bloquée dans la boucle modale d'AppKit.
  if (e->type == SDL_EVENT_WINDOW_RESIZED || e->type == SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED) {
    static_cast<Shell*>(userdata)->syncWindowGeometry();
  }
  return true;
}

int displayRefreshRate(SDL_Window* window) {
  const SDL_DisplayMode* m = SDL_GetCurrentDisplayMode(SDL_GetDisplayForWindow(window));
  return (m && m->refresh_rate > 1) ? int(m->refresh_rate + 0.5f) : 60;
}

CefSettings makeSettings(const AppOptions& o) {
  CefSettings s;
  s.no_sandbox = true;
  s.windowless_rendering_enabled = true;
  s.external_message_pump = true;
  s.multi_threaded_message_loop = false;
  s.remote_debugging_port = o.devtoolsPort;
  s.background_color = CefColorSetARGB(0, 0, 0, 0);
  s.log_severity = LOGSEVERITY_WARNING;
  std::error_code ec;
  std::filesystem::create_directories(o.profileDir, ec);
  auto profile = std::filesystem::weakly_canonical(o.profileDir, ec).string();
  CefString(&s.root_cache_path) = profile;
  CefString(&s.cache_path) = profile;
  CefString(&s.log_file) = profile + "/cef.log";
  // navigator.language(s) et Accept-Language suivent le système (CEF : « en-US,en » sinon).
  CefString(&s.accept_language_list) = platform::acceptLanguages();
  return s;
}

VideoSurface* g_fakeVideo = nullptr;

}  // namespace

std::unique_ptr<VideoSurface> createMainVideoSurface(const AppContext& ctx) {
  return createVideoSurface(ctx.nativeWindow);
}

void restoreFakeVideo(const AppContext& ctx) { ctx.compositor->setVideoLayer(g_fakeVideo); }

int runApp(int argc, char** argv) {
  AppOptions opts;
  if (!parseArgs(argc, argv, opts)) return 2;
  paths::configure(opts.extra);  // reseau : --user-data (shell/paths.h)
  if (opts.url.empty()) opts.url = platform::resourceUrl("page.html");

  platform::initApplication();
  // Cycle de vie (axe systeme) : ligne de commande gardée, relance, liens du système, et la
  // dernière fenêtre fermée qui ne vaut pas « quitter ».
  lifecycle::app::beforeSdl(argc, argv, opts);
  SDL_SetAppMetadata("Tentacle", "0.1.0", "tv.tentacle.proto.cef");
  if (!SDL_Init(SDL_INIT_VIDEO)) {
    std::fprintf(stderr, "SDL_Init : %s\n", SDL_GetError());
    return 1;
  }
  SDL_WindowFlags flags = SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIGH_PIXEL_DENSITY | SDL_WINDOW_HIDDEN;
#ifdef __linux__
  // Wayland : la page est transparente au-dessus de la sous-surface vidéo — sans ce drapeau,
  // SDL déclare la surface opaque et le compositeur ne dessine plus ce qu'elle couvre.
  if (const char* d = SDL_GetCurrentVideoDriver(); d && std::string_view(d) == "wayland") {
    flags |= SDL_WINDOW_TRANSPARENT;
  }
#endif
  // --size est en DIP (1280×800 comme Electron) ; SDL compte en unités de fenêtre : des
  // pixels sous Windows et X11, où l'échelle du contenu (150 %…) les multiplie. 1 sur macOS.
  float contentScale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());
  if (!(contentScale > 0.0f)) contentScale = 1.0f;
  SDL_Window* window =
      SDL_CreateWindow("Tentacle", int(opts.width * contentScale), int(opts.height * contentScale), flags);
  if (!window) {
    std::fprintf(stderr, "SDL_CreateWindow : %s\n", SDL_GetError());
    return 1;
  }
  // SDL3 marque sa NSWindow en sRGB et macOS ne relit cet espace qu'à la mise à l'écran :
  // on le rend AVANT le premier affichage (vidéo-HDR, INTEGRATION 01:55), sans quoi la
  // création de la surface vidéo devrait retirer/remettre la fenêtre (scintillement).
  prepareWindowForVideo(platform::nativeWindow(window));
  lifecycle::app::prepareWindow(window);  // cadre d'Electron, 900×600 au moins, régions déplaçables
  auto compositor = Compositor::create(window);
  std::unique_ptr<VideoSurface> fake;
  if (opts.fakeVideoEdr > 0) {
    fake = Compositor::createFakeEdrSurface(window, opts.fakeVideoEdr);
    compositor->setVideoLayer(fake.get());
  } else if (opts.fakeVideo) {
    fake = Compositor::createFakeVideoSurface(window, *opts.fakeVideo);
    compositor->setVideoLayer(fake.get());
  }
  g_fakeVideo = fake.get();

  // La pompe existe avant CefInitialize : le premier OnScheduleMessagePumpWork arrive
  // pendant l'initialisation.
  auto pump = MessagePump::create();
  CefRefPtr<BrowserApp> app = new BrowserApp(pump.get());
#if defined(_WIN32)
  CefMainArgs mainArgs(GetModuleHandleW(nullptr));  // CEF relit lui-même la ligne de commande
#else
  CefMainArgs mainArgs(argc, argv);
#endif
  CefSettings settings = makeSettings(opts);
  if (!CefInitialize(mainArgs, settings, app, nullptr)) {
    // Instance unique : une instance tourne déjà sur ce profil et a reçu notre ligne de
    // commande (lien, focus) — on sort sans bruit, comme la seconde instance d'Electron.
    if (lifecycle::app::handedToRunningInstance()) {
      std::fprintf(stderr, "[app] une instance tourne déjà sur ce profil : elle prend le relais\n");
      return 0;
    }
    std::fprintf(stderr, "CefInitialize a échoué (code %d)\n", CefGetExitCode());
    return 1;
  }

  // Front embarqué sous tentacle://app (l'origine d'Electron), pour --url=tentacle://app/.
  if (auto it = opts.extra.find("web-root"); it != opts.extra.end() && !it->second.empty()) {
    if (!appscheme::serveWebRoot(it->second)) {
      CefShutdown();
      return 1;
    }
  }

  AppContext ctx{window, platform::nativeWindow(window), compositor.get(), &opts, fake.get()};
  registerBuiltinHandlers(ctx);
  initModules(ctx);

  ShellOptions so;
  so.url = opts.url;
  so.frameRate = opts.frameRate > 0 ? opts.frameRate : displayRefreshRate(window);
  so.fixedFrameRate = opts.frameRate > 0;
  auto shell = std::make_unique<Shell>(window, compositor.get(), so);
  setBuiltinShell(shell.get());
  SDL_AddEventWatch(onWindowEvent, shell.get());
  SDL_StartTextInput(window);
  SDL_ShowWindow(window);
  platform::prepareWindow(window, !opts.background);
  shell->syncWindowGeometry();
  std::fprintf(stderr, "[app] %s — %d Hz, DevTools %d, profil %s\n", so.url.c_str(),
               so.frameRate, opts.devtoolsPort, opts.profileDir.c_str());
  lifecycle::app::attach(shell.get(), window);
  if (!shell->start()) {
    std::fprintf(stderr, "CreateBrowser a échoué\n");
    return 1;
  }

  // Fermer, quitter, finir les transferts sans fenêtre, dire au revoir à Jellyfin : le cycle de
  // vie décide quand la boucle s'arrête (src/lifecycle/exit_flow.h).
  while (lifecycle::app::running()) {
    SDL_Event e;
    const int timeout = lifecycle::app::waitTimeoutMs();
    if (!(timeout < 0 ? SDL_WaitEvent(&e) : SDL_WaitEventTimeout(&e, timeout))) {
      lifecycle::app::afterEvents();
      continue;
    }
    do {
      if (pump->handleSdlEvent(e.type)) continue;
      if (lifecycle::app::handleEvent(e)) continue;
      if (!lifecycle::app::windowAlive()) continue;
      shell->handleEvent(e);
      if (e.type == SDL_EVENT_WINDOW_ENTER_FULLSCREEN ||
          e.type == SDL_EVENT_WINDOW_LEAVE_FULLSCREEN || e.type == SDL_EVENT_WINDOW_RESIZED) {
        notifyWindowState();
      }
    } while (SDL_PollEvent(&e));
    lifecycle::app::afterEvents();
  }

  SDL_RemoveEventWatch(onWindowEvent, shell.get());
  shutdownModules();
  setBuiltinShell(nullptr);
  shell.reset();
  CefShutdown();
  compositor->setVideoLayer(nullptr);
  g_fakeVideo = nullptr;
  fake.reset();
  compositor.reset();
  SDL_DestroyWindow(window);
  SDL_Quit();
  lifecycle::app::afterShutdown();  // anti-veille et anti-suspension rendues au système
  return 0;
}

}  // namespace tentacle
