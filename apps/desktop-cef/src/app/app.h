#pragma once
// Application : SDL3 + CEF + compositeur, et point d'accroche des modules.

#include <SDL3/SDL.h>

#include <memory>

#include "app/args.h"
#include "compositor/compositor.h"

namespace tentacle {

class Shell;

// Ce que voit un module à son initialisation (avant la création du navigateur : c'est le
// moment d'appeler ipc::registerHandler / ipc::registerInjectedScript).
struct AppContext {
  SDL_Window* window = nullptr;
  void* nativeWindow = nullptr;       // macOS : NSWindow* (pour createVideoSurface)
  Compositor* compositor = nullptr;
  const AppOptions* options = nullptr;
  VideoSurface* fakeVideo = nullptr;  // couche factice posée par défaut (peut être nullptr)
};

// Crée la VRAIE surface vidéo de la fenêtre principale (vidéo-HDR : createVideoSurface).
// À appeler juste avant le premier `loadfile` d'une vidéo (la couche naît à ce moment),
// puis `ctx.compositor->setVideoLayer(surface.get())` — ce qui remplace la couche factice.
// Avant de détruire la surface : `setVideoLayer(nullptr)` (ou `restoreFakeVideo(ctx)`).
std::unique_ptr<VideoSurface> createMainVideoSurface(const AppContext& ctx);
// Remet la couche factice (ou rien si --fake-video=off) sous la page.
void restoreFakeVideo(const AppContext& ctx);

// src/app/modules.cpp : chaque module y ajoute UNE ligne d'appel à son init.
void initModules(AppContext& ctx);
void shutdownModules();

int runApp(int argc, char** argv);

}  // namespace tentacle
