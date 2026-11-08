#pragma once
// Ce que l'application attend de l'OS (implémenté dans src/platform/<os>/app_*).

#include <SDL3/SDL.h>

#include <string>

namespace tentacle::platform {

// Avant SDL_Init et CefInitialize (macOS : NSApplication conforme à CefAppProtocol).
void initApplication();
// Poignée native de la fenêtre SDL (macOS : NSWindow*).
void* nativeWindow(SDL_Window* window);
// Après création de la fenêtre : apparence, fond, focus.
void prepareWindow(SDL_Window* window, bool activate);
// Langues préférées du système, au format Accept-Language de CEF (« fr-CH,fr,en-AU,en »),
// ou "" (CEF garde alors sa valeur par défaut). Electron suit le système : nous aussi.
std::string acceptLanguages();
// URL file:// d'une ressource livrée avec l'application (page de test), ou "".
std::string resourceUrl(const char* name);

}  // namespace tentacle::platform
