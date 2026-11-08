#pragma once
// Horloge d'images native : BeginFrame externe de CEF, calée sur la vsync de l'écran
// (implémentation par OS : src/platform/<os>/shell_frame_clock*).
//
// macOS : le minuteur BeginFrame interne de CEF retombe à 60 Hz dès que la fréquence est
// réappliquée à chaud (ouverture d'une popup <select>, SetWindowlessFrameRate) — mesuré au
// banc (rAF 120 → 60). Comme les ères 2 et 3 de la référence, un CADisplayLink pilote donc
// SendExternalBeginFrame(). Ailleurs, frameClockSupported() = false : minuteur interne.

#include <SDL3/SDL.h>

#include <functional>

namespace tentacle::platform {

bool frameClockSupported();
// tick est appelé sur le fil principal à chaque vsync de l'écran de la fenêtre, y compris
// pendant le redimensionnement en direct et les menus (modes « common » de la run loop).
bool startFrameClock(SDL_Window* window, std::function<void()> tick);
void stopFrameClock();
// Veille (CPU au repos, axe ram) : une page immobile ne doit pas réveiller le fil principal,
// le GPU et le Renderer 120 fois par seconde. Le Shell choisit le mode :
//  - full : chaque vsync de l'écran ;
//  - idle : rien de peint depuis 250 ms → le lien ralentit (10 Hz demandés ; macOS en
//    tient ~40 sur l'écran 120 Hz, mesuré : rAF à 4–25 ms après une modification ; 10 Hz
//    écran verrouillé : ~100 ms) ;
//  - deepIdle : rien depuis 3 s → lien suspendu, BeginFrame de sondage à kDeepIdleFrameClockHz.
// Une image peinte ou une saisie remet `full` aussitôt ; un signal de la page (shell/
// frame_wake.h : rAF, mutation du DOM, animation CSS…) ou la fin d'un chargement réseau
// (iframes comprises) envoie un BeginFrame tout de suite. La sonde n'est qu'un filet de
// sécurité pour le reste (5 s au plus) : à 1 Hz elle coûtait 0,11 % d'un cœur au repos.
enum class FrameClockMode { full, idle, deepIdle };
constexpr int kIdleFrameClockHz = 10;
constexpr double kDeepIdleFrameClockHz = 0.2;
void setFrameClockMode(FrameClockMode mode);

}  // namespace tentacle::platform
