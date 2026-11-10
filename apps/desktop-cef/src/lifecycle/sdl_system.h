#pragma once
// Ce que SDL3 fait pour Linux et Windows à la place d'une boîte GTK ou d'un TaskDialog écrit à
// la main : la boîte « quitter quand même ? » (SDL_ShowMessageBox : TaskDialog sous Windows,
// zenity puis X11 sous Linux), le sélecteur de dossier (SDL_ShowOpenFolderDialog : IFileDialog
// sous Windows, portail XDG puis zenity sous Linux) et l'icône de la fenêtre (PNG partagé).
// Appelé par src/platform/<linux|windows>/lifecycle_system_*.

#include <SDL3/SDL.h>

#include <functional>
#include <optional>
#include <string>

#include "lifecycle/texts.h"

namespace tentacle::lifecycle {

/// Boîte modale ; `answer` au tour suivant de la boucle. Échec d'affichage → `answer(true)`.
void askQuitWithSdl(SDL_Window* window, const QuitTexts& texts, std::function<void(bool quit)> answer);
/// Sélecteur de dossier ; `done` sur le fil principal (nullopt : annulé ou échec).
void pickFolderWithSdl(SDL_Window* window, std::function<void(std::optional<std::string>)> done);
/// L'icône de l'app (`appIcon.ts` : `icon.png`) posée sur la fenêtre — à côté de l'exécutable
/// (paquet), sinon celle du dépôt (`apps/desktop-electron/icons`, développement).
void setWindowIconFromPng(SDL_Window* window);

}  // namespace tentacle::lifecycle
