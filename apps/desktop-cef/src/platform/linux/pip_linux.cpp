// PiP sous Linux : la fenêtre PiP portable sur SDL3 (`src/pip/sdl/`), dès que le compositeur
// de ce système sait prêter sa vidéo (`Compositor::canLendVideo`) — sous Wayland
// (compositor_linux.cpp, VideoSlot). X11 : la fabrique rend nullptr, les commandes pip_* ne sont
// pas déclarées et la page cache « Réduire » (comme Electron hors de ses montages pris en charge).
// La pile de la fenêtre PiP est un compositeur Linux de plus, transparent (`makeStack`), dont le
// contexte EGL partage ses textures avec celui de la fenêtre principale.
//
// Wayland : un client ne place pas ses fenêtres (SDL n'y change que la taille) — la place du PiP
// revient au compositeur (colle KWin d'Electron : le titre, `pip/rules/pip_captions.h`). Le
// glisser lui est donc CONFIÉ (xdg_toplevel.move, `wayland_move_linux.h`) : détaché, le PiP se
// déplace sous le pointeur comme par une barre de titre. Ancré, c'est une SURGISSANTE de la
// fenêtre principale (xdg_popup) : posée dans son coin, elle la suit et se réduit avec elle.

#include "compositor/compositor.h"
#include "pip/pip_platform.h"
#include "pip/sdl/pip_sdl.h"
#include "platform/linux/wayland_move_linux.h"

namespace tentacle::pip {

std::unique_ptr<Platform> createPlatform(SDL_Window* host, void*, Compositor* hostStack) {
  if (!hostStack || !hostStack->canLendVideo()) return nullptr;
  sdl::Options o;
  // À l'axe linux : la pile de la fenêtre PiP, transparente sous la page.
  o.makeStack = [](SDL_Window* pip) { return Compositor::create(pip); };
  o.transparent = true;  // la page dessine liseré et ombre dans la marge (`pipFrame.ts`)
  // Les appuis se relèvent dès maintenant : celui qui commencera un glisser aura son numéro.
  platform::watchPointerPresses(host);
  o.systemMove = [](SDL_Window* pip) { return platform::beginCompositorMove(pip); };
  o.onEvent = [] { platform::drainPointerPresses(); };
  o.popupWhenDocked = true;
  return sdl::createPlatform(host, std::move(o));
}

}  // namespace tentacle::pip
