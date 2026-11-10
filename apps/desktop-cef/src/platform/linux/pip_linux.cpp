// PiP sous Linux : la fenêtre PiP portable sur SDL3 (`src/pip/sdl/`), dès que le compositeur
// de ce système sait prêter sa vidéo (`Compositor::canLendVideo`) — sous Wayland
// (compositor_linux.cpp, VideoSlot). X11 : la fabrique rend nullptr, les commandes pip_* ne sont
// pas déclarées et la page cache « Réduire » (comme Electron hors de ses montages pris en charge).
// La pile de la fenêtre PiP est un compositeur Linux de plus, transparent (`makeStack`), dont le
// contexte EGL partage ses textures avec celui de la fenêtre principale.
//
// Wayland : un client ne place pas ses fenêtres (SDL n'y change que la taille) — la place du PiP
// revient au compositeur (colle KWin d'Electron : le titre, `pip/rules/pip_captions.h`).

#include "compositor/compositor.h"
#include "pip/pip_platform.h"
#include "pip/sdl/pip_sdl.h"

namespace tentacle::pip {

std::unique_ptr<Platform> createPlatform(SDL_Window* host, void*, Compositor* hostStack) {
  if (!hostStack || !hostStack->canLendVideo()) return nullptr;
  sdl::Options o;
  // À l'axe linux : la pile de la fenêtre PiP, transparente sous la page.
  o.makeStack = [](SDL_Window* pip) { return Compositor::create(pip); };
  o.transparent = true;  // la page dessine liseré et ombre dans la marge (`pipFrame.ts`)
  return sdl::createPlatform(host, std::move(o));
}

}  // namespace tentacle::pip
