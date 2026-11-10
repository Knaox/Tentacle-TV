#pragma once
// Le PiP sur une fenêtre SDL3 — la `pip::Platform` portable de Linux et Windows.
//
// SDL fabrique la fenêtre PiP (sans cadre, hors barre des tâches, au-dessus en flottant),
// donne les écrans et le curseur ; la souris de la fenêtre PiP va à SA page par un filtre
// d'évènements SDL (`SDL_SetEventFilter`, chaîné au précédent) : aucun aiguillage dans la
// boucle de l'app, la fenêtre principale ne voit jamais ces évènements. Ce que l'OS doit
// fournir : la pile de couches de la fenêtre PiP (`makeStack`, son compositeur, qui sait
// recevoir la vidéo prêtée — `Compositor::lendVideo`) et, s'il le veut, ses réglages.
//
// Coordonnées : SDL compte en pixels sous Windows et X11, en points sous macOS et Wayland ;
// le PiP compte en points (DIP). Le facteur est celui de l'écran de la fenêtre principale
// (`SDL_GetWindowDisplayScale / SDL_GetWindowPixelDensity`) — des écrans d'échelles
// différentes restent à éprouver (docs/A-TESTER-<OS>.md).
//
// Sous Wayland, un client ne place pas ses fenêtres : `setBounds` n'y change que la taille,
// et la place revient au compositeur (la colle KWin d'Electron lit pour cela le titre,
// `pip_captions.h`) — à l'axe linux d'en décider.

#include <functional>
#include <memory>

#include "pip/pip_ports.h"

struct SDL_Window;

namespace tentacle::pip::sdl {

struct Options {
  /// La pile de couches de la fenêtre PiP (obligatoire) : la page en haut, transparente là où
  /// elle ne dessine rien, la vidéo prêtée dessous (Compositor::lendVideo / setVideoInset).
  std::function<std::unique_ptr<Compositor>(SDL_Window* pip)> makeStack;
  /// Fenêtre transparente (le cadre et l'ombre dessinés par la page). Windows : non — la
  /// fenêtre y est opaque, cadre et coins sont ceux du système (`pipFrame.ts`).
  bool transparent = true;
  /// « Réduire les animations » du système (GNOME : enable-animations ; Windows :
  /// SPI_GETCLIENTAREAANIMATION). Sans : faux.
  std::function<bool()> reducedMotion;
  /// Le focus rendu à la fenêtre principale (macOS seulement chez Electron : ailleurs, le
  /// premier clic d'une fenêtre inactive arrive). Sans : rien.
  std::function<void()> focusHost;
  /// Wayland : le glisser confié au compositeur (`Window::beginSystemMove`). Sans : la session
  /// déplace la fenêtre en suivant le curseur.
  std::function<bool(SDL_Window* pip)> systemMove;
  /// Chaque évènement SDL de la fenêtre PiP, avant son traitement (son filtre les avale : un
  /// observateur SDL ne les voit pas). Sans : rien.
  std::function<void()> onEvent;
};

std::unique_ptr<Platform> createPlatform(SDL_Window* host, Options options);

}  // namespace tentacle::pip::sdl
