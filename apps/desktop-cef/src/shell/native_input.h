#pragma once
// Saisie native complémentaire de SDL3 (implémentation par OS : src/platform/<os>/shell_native_input*).
//
// Défilement : SDL3 aplatit le NSEvent (deltas « précis » ×0,1, plus de distinction trackpad /
// molette à crans) ; Chromium attend des pixels et un repère « précis ». Sur macOS, on lit donc
// le défilement directement (moniteur NSEvent local) et l'on ignore SDL_EVENT_MOUSE_WHEEL.
// Ailleurs, installNativeWheel renvoie false et SDL reste la source.

#include <SDL3/SDL.h>

#include <functional>
#include <string>

#include "shell/json.h"

namespace tentacle::platform {

struct NativeWheel {
  float x = 0, y = 0;    // position en points (origine en haut à gauche de la vue)
  float dx = 0, dy = 0;  // pixels (convention Chromium : dy > 0 = vers le haut du document)
  bool precise = false;  // trackpad / souris Magic (deltas continus)
  // Un NOUVEAU geste physique commence (trackpad, souris Magic : les doigts se reposent). CEF ne
  // transmet pas les phases du geste à Chromium : le routeur s'en sert pour rompre l'accroche
  // de la molette à la zone du geste précédent (input.cpp). Toujours faux pour une molette à crans.
  bool begins = false;
};

// Pixels par cran quand SDL3 est la source (Linux ; la fenêtre PiP partout). Linux : la valeur
// de Chromium — Wayland, axis_value120 → 120 par cran ; X11, kWheelScrollAmount = 120 depuis
// crbug.com/1270089 —, celle qu'Electron envoie à la même page (à 40, il fallait trois crans
// pour un). Une molette haute résolution (fractions de cran chez SDL) garde la même course.
// Ailleurs, les 40 d'avant (macOS : kScrollbarPixelsPerCocoaTick), pas encore éprouvés.
#ifdef __linux__
inline constexpr float kSdlWheelNotchPixels = 120.0f;
#else
inline constexpr float kSdlWheelNotchPixels = 40.0f;
#endif

bool installNativeWheel(SDL_Window* window, std::function<void(const NativeWheel&)> sink);
void uninstallNativeWheel();

// Banc (option --debug-input seulement) : poste un évènement NATIF dans la file de l'app,
// qui suit ensuite le vrai chemin (AppKit → SDL3 → socle → CEF). Aucune permission système
// requise : l'app ne s'envoie qu'à elle-même. Voir builtin_handlers.h (shell.debug.native).
// Renvoie "" ou un message d'erreur.
std::string injectNative(SDL_Window* window, const Json& ev);

}  // namespace tentacle::platform
