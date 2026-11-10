// PiP sous Windows : la fenêtre PiP portable sur SDL3 (`src/pip/sdl/`), sur la pile
// DirectComposition de ce système, qui sait prêter sa vidéo (`Compositor::canLendVideo`, vrai) :
// le visuel de la chaîne d'échange de mpv passe de l'arbre de la fenêtre principale à celui de
// la fenêtre PiP et revient (`compositor_windows.cpp`), sans nouvelle sortie de mpv — tous les
// arbres viennent du même périphérique DComp (`dcomp_context_windows.h`).
//
// Si le compositeur n'a pas pu naître (aucun D3D11 : NullCompositor), la fabrique rend nullptr :
// les commandes pip_* ne sont pas déclarées et la page cache « Réduire » (comme Electron hors de
// ses montages pris en charge).
//
// La fenêtre, comme celle d'Electron sous Windows (`pipFrame.ts`) : OPAQUE, sans marge (cadre
// 0/0, `pip/rules/pip_frame.h`), coins arrondis et bords de redimensionnement du SYSTÈME. SDL ne
// donne pas de bords à une fenêtre sans bordure (pas de WS_THICKFRAME) : une bande de
// `kResizeBandDip` le long des bords répond à WM_NCHITTEST par les zones de redimensionnement
// (SDL_SetWindowHitTest) ; la garde du PiP (ratio, bornes) s'applique après (pip_sdl_window.cpp).

#include <SDL3/SDL.h>
#include <windows.h>
#include <dwmapi.h>

#include <algorithm>
#include <cmath>

#include "compositor/compositor.h"
#include "pip/pip_platform.h"
#include "pip/sdl/pip_sdl.h"

namespace tentacle::pip {
namespace {

// DWMWA_WINDOW_CORNER_PREFERENCE / DWMWCP_ROUND : Windows 11 (absents des SDK d'avant 22000) ;
// Windows 10 refuse l'attribut, sans effet.
constexpr DWORD kCornerPreference = 33;
constexpr int kCornerRound = 2;
// Épaisseur des bords saisissables, en DIP (un bord de Windows 11 en fait ~8, hors fenêtre).
constexpr double kResizeBandDip = 6;

SDL_HitTestResult SDLCALL hitTest(SDL_Window* window, const SDL_Point* p, void*) {
  int w = 0, h = 0;
  SDL_GetWindowSize(window, &w, &h);  // pixels sous Windows, comme `p`
  const int band = std::max(1, int(std::lround(kResizeBandDip * SDL_GetWindowDisplayScale(window))));
  const bool left = p->x < band, right = p->x >= w - band, top = p->y < band, bottom = p->y >= h - band;
  if (top && left) return SDL_HITTEST_RESIZE_TOPLEFT;
  if (top && right) return SDL_HITTEST_RESIZE_TOPRIGHT;
  if (bottom && left) return SDL_HITTEST_RESIZE_BOTTOMLEFT;
  if (bottom && right) return SDL_HITTEST_RESIZE_BOTTOMRIGHT;
  if (left) return SDL_HITTEST_RESIZE_LEFT;
  if (right) return SDL_HITTEST_RESIZE_RIGHT;
  if (top) return SDL_HITTEST_RESIZE_TOP;
  if (bottom) return SDL_HITTEST_RESIZE_BOTTOM;
  return SDL_HITTEST_NORMAL;  // la page (et ses gestes `pip_gesture`)
}

// Ce que le système donne à la fenêtre PiP d'Electron (frameless, resizable) : coins et bords.
void dressWindow(SDL_Window* pip) {
  if (auto* hwnd = static_cast<HWND>(
          SDL_GetPointerProperty(SDL_GetWindowProperties(pip), SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr))) {
    const int round = kCornerRound;
    DwmSetWindowAttribute(hwnd, kCornerPreference, &round, sizeof round);
  }
  SDL_SetWindowHitTest(pip, hitTest, nullptr);
}

}  // namespace

std::unique_ptr<Platform> createPlatform(SDL_Window* host, void*, Compositor* hostStack) {
  if (!hostStack || !hostStack->canLendVideo()) return nullptr;
  sdl::Options o;
  // La pile de la fenêtre PiP : son propre arbre DComp (page en haut, vidéo prêtée dessous).
  // La fabrique est appelée sur la fenêtre neuve, avant son premier affichage : c'est là qu'elle
  // reçoit aussi son habit (coins, bords).
  o.makeStack = [](SDL_Window* pip) {
    dressWindow(pip);
    return Compositor::create(pip);
  };
  // Fenêtre OPAQUE : la cible « topmost » compose page et vidéo par-dessus son fond noir. Une
  // fenêtre transparente y perdrait ses bords (Electron, `window.ts`). L'ancré est une fenêtre
  // POSSÉDÉE (SDL_SetWindowParent), qui suit la principale.
  o.transparent = false;
  // « Réduire les animations » : ce qu'Electron lit sous Windows
  // (`prefersReducedMotion` = animations de la zone client coupées).
  o.reducedMotion = [] {
    BOOL animate = TRUE;
    return SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION, 0, &animate, 0) && !animate;
  };
  return sdl::createPlatform(host, std::move(o));
}

}  // namespace tentacle::pip
