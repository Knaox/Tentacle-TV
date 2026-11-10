// PiP sous Linux : la fenêtre PiP portable sur SDL3 (`src/pip/sdl/`), dès que le compositeur
// de ce système sait prêter sa vidéo (`Compositor::canLendVideo`). D'ici là, la fabrique rend
// nullptr : les commandes pip_* ne sont pas déclarées et la page cache « Réduire » (comme
// Electron hors de ses montages pris en charge).
//
// Ce qu'il reste à l'axe linux (docs/INTERFACES.md, « PiP ») : dans SON compositeur,
// `canLendVideo` (vrai), `lendVideo` / `reclaimVideo` (la couche vidéo passe dans la pile de la
// fenêtre PiP et revient, sans nouvelle sortie de mpv), `setVideoInset` (la vidéo à `inset`
// points des bords), et une pile TRANSPARENTE pour la fenêtre PiP (`makeStack` ci-dessous).
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
