#pragma once
// Electron ne zoome JAMAIS la page de Tentacle : Ctrl+molette n'émet que `zoom-changed`, que
// personne n'écoute ; aucun menu n'a de rôle de zoom ; le zoom visuel (pincement) est bloqué
// par défaut. CEF, lui, applique Ctrl+molette hors macOS (ContentsZoomChange) et retient le
// niveau par origine dans le profil. La garde le remet à zéro après chaque Ctrl+molette.
// (macOS : Chromium ne zoome pas à la molette ; ⌘= et ⌘− n'ont aucun effet sous CEF, mesuré.)

#include <SDL3/SDL.h>

#include "include/cef_browser.h"

namespace tentacle {

void guardZoom(const SDL_Event& e, CefRefPtr<CefBrowser> browser);

}  // namespace tentacle
