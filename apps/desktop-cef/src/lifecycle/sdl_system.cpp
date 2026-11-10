#include "lifecycle/sdl_system.h"

#include <filesystem>
#include <memory>
#include <vector>

#include "shell/main_thread.h"

namespace tentacle::lifecycle {

void askQuitWithSdl(SDL_Window* window, const QuitTexts& texts, std::function<void(bool)> answer) {
  // Au tour suivant : la boîte est modale (elle bloque la boucle), jamais au milieu du
  // traitement d'un évènement de fermeture.
  postToMain([window, texts, answer = std::move(answer)] {
    const std::string message = texts.message + "\n\n" + texts.detail;
    // Dans l'ordre d'Electron ([quitter, annuler]) ; « Annuler » prend Entrée et Échap.
    const SDL_MessageBoxButtonData buttons[] = {
        {0, 0, texts.quitApp.c_str()},
        {SDL_MESSAGEBOX_BUTTON_RETURNKEY_DEFAULT | SDL_MESSAGEBOX_BUTTON_ESCAPEKEY_DEFAULT, 1,
         texts.cancelLabel.c_str()},
    };
    SDL_MessageBoxData data{};
    data.flags = SDL_MESSAGEBOX_WARNING | SDL_MESSAGEBOX_BUTTONS_LEFT_TO_RIGHT;
    data.window = window;
    data.title = texts.title.c_str();
    data.message = message.c_str();
    data.numbuttons = 2;
    data.buttons = buttons;
    int chosen = -1;
    // La boîte n'a pas pu s'afficher : on quitte (`quitGuard.ts` : ne jamais enfermer).
    if (!SDL_ShowMessageBox(&data, &chosen)) return answer(true);
    answer(chosen == 0);
  });
}

namespace {

struct FolderRequest {
  std::function<void(std::optional<std::string>)> done;
};

// Appelé par SDL, parfois depuis un autre fil (portail, fil du dialogue Windows).
void SDLCALL onFolder(void* userdata, const char* const* files, int) {
  std::unique_ptr<FolderRequest> request(static_cast<FolderRequest*>(userdata));
  std::optional<std::string> path;
  if (files && files[0]) path = std::string(files[0]);
  postToMain([done = std::move(request->done), path] { done(path); });
}

}  // namespace

void pickFolderWithSdl(SDL_Window* window, std::function<void(std::optional<std::string>)> done) {
  SDL_ShowOpenFolderDialog(onFolder, new FolderRequest{std::move(done)}, window, nullptr, false);
}

void setWindowIconFromPng(SDL_Window* window) {
  namespace fs = std::filesystem;
  std::vector<fs::path> candidates;
  if (const char* base = SDL_GetBasePath()) {
    candidates.push_back(fs::path(base) / "icon.png");
    candidates.push_back(fs::path(base) / "resources" / "icon.png");
  }
#ifdef TENTACLE_DEV_ICON
  candidates.push_back(fs::path(TENTACLE_DEV_ICON));  // le dépôt, en développement
#endif
  for (const auto& path : candidates) {
    std::error_code ec;
    if (!fs::exists(path, ec)) continue;
    // Une image vide voudrait dire un fichier déplacé ou d'un autre format : on n'efface pas
    // l'icône pour autant (`appIdentity.ts`).
    SDL_Surface* icon = SDL_LoadPNG(path.string().c_str());
    if (!icon) continue;
    SDL_SetWindowIcon(window, icon);
    SDL_DestroySurface(icon);
    return;
  }
}

}  // namespace tentacle::lifecycle
