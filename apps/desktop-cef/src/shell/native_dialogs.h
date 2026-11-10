#pragma once
// Boîtes natives de l'OS (implémentées dans src/platform/<os>/dialogs_<os>.*) : ce qu'elles
// montrent est décidé par la règle pure `shell/dialog_rule.h` (celle d'Electron). Comme
// Electron, elles sont ATTACHÉES à la fenêtre de l'app : feuille sur macOS, boîte modale
// possédée par la fenêtre sous Windows, transitoire (X11) sous Linux.

#include <SDL3/SDL.h>

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "shell/dialog_rule.h"

namespace tentacle::platform {

/// Une boîte ouverte. `dismiss()` la ferme SANS rappeler sa fonction de fin (navigation,
/// fermeture de la page, banc) : c'est l'appelant qui répond à la page.
class NativeDialog {
 public:
  virtual ~NativeDialog() = default;
  virtual void dismiss() = 0;
};

/// `done(response)` : index du bouton, ou `box.cancelId` si fermée sans bouton. Fil principal.
using MessageDone = std::function<void(int response)>;
/// `done(paths)` : chemins choisis, `std::nullopt` si annulé. Fil principal.
using FileDone = std::function<void(std::optional<std::vector<std::string>> paths)>;

std::unique_ptr<NativeDialog> showMessageBox(SDL_Window* parent, const dialogs::MessageBox& box,
                                             MessageDone done);

/// Faux sans boîte native ici (Linux : la boîte de Chromium — portail XDG, sinon GTK — fait foi,
/// comme sous Electron) ; l'appelant laisse alors CEF afficher la sienne.
bool hasNativeFileDialog();
std::unique_ptr<NativeDialog> showFileDialog(SDL_Window* parent, const dialogs::FileRequest& request,
                                             FileDone done);

}  // namespace tentacle::platform
