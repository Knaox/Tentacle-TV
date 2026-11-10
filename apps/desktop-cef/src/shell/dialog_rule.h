#pragma once
// Ce que montrent les boîtes du navigateur — règle PURE, sans CEF ni OS, celle d'Electron 43 :
//   - `<input type=file>` : `WebDialogHelper::RunFileChooser` + `GetFileTypesFromAcceptType`
//     (electron/shell/browser/web_dialog_helper.cc) ;
//   - téléchargement lancé par la page : boîte d'enregistrement de
//     `ElectronDownloadManagerDelegate::OnDownloadPathGenerated` (titre = l'URL) ;
//   - `alert` / `confirm` / `prompt` : `ElectronJavaScriptDialogManager` (boutons « OK » et
//     « Cancel » écrits en anglais par Electron, `prompt` non pris en charge → `null`).
// Les panneaux natifs (`platform/<os>/dialogs_*`) ne font qu'afficher ce qui est décidé ici.

#include <optional>
#include <string>
#include <vector>

namespace tentacle::dialogs {

/// Un filtre de la boîte : nom affiché et extensions SANS point ; « * » = tous les fichiers.
struct FileFilter {
  std::string name;
  std::vector<std::string> extensions;
};

enum class FileMode { open, openMultiple, openFolder, save };

struct FileRequest {
  FileMode mode = FileMode::open;
  std::string title;        // vide : titre par défaut du système
  std::string defaultPath;  // dossier et/ou nom proposé, vide : choix du système
  std::vector<FileFilter> filters;
  bool createDirectory = false;          // OPEN_DIALOG_CREATE_DIRECTORY
  bool treatPackageAsDirectory = false;  // OPEN_DIALOG_TREAT_PACKAGE_APP_AS_DIRECTORY (macOS)
};

/// `GetFileTypesFromAcceptType` : `acceptFilters[i]` est un type MIME (« image/* ») ou une
/// extension (« .flac ») ; `acceptExtensions[i]` l'expansion du MIME en « .png;.jpg;… » (celle
/// de `net::GetExtensionsForMimeType`, faite par CEF). Vide si rien d'utilisable ; sinon le
/// filtre décrit, puis « All Files » (« * »).
std::vector<FileFilter> filtersFromAccept(const std::vector<std::string>& acceptFilters,
                                          const std::vector<std::string>& acceptExtensions);

/// La boîte d'un `<input type=file>` : `lastDirectory` est le dernier dossier choisi
/// (`prefs::kSelectFileLastDirectory`), `defaultName` le nom proposé par la page.
FileRequest webFileChooser(FileMode mode, const std::string& title, const std::string& defaultName,
                           const std::string& lastDirectory, std::vector<FileFilter> filters);

/// La boîte d'enregistrement d'un téléchargement : titre = URL, proposé = dossier (le dernier
/// choisi, sinon Téléchargements) + nom suggéré.
FileRequest downloadSave(const std::string& url, const std::string& directory,
                         const std::string& suggestedName);

/// Une liste de chemins rendue à la page (panneau, téléchargement) : au moins un, aucun vide.
/// Un chemin vide arrivait jusqu'à Chromium, qui le passait à `-[NSWorkspace
/// isFilePackageAtPath:]` sous forme nil : l'app tombait (NSInternalInconsistencyException).
bool pathsUsable(const std::vector<std::string>& paths);

/// Joint un dossier et un nom (séparateur `sep`), sans doubler le séparateur.
std::string joinPath(const std::string& dir, const std::string& name, char sep);

/// Le dossier d'un chemin (tout ce qui précède le dernier séparateur), "" sans séparateur.
std::string dirName(const std::string& path);

struct MessageBox {
  std::string message;
  std::vector<std::string> buttons;
  int defaultId = -1;  // -1 : aucun bouton désigné
  int cancelId = 0;    // réponse d'une fermeture sans bouton (Échap)
};

enum class JsKind { alert, confirm, prompt };

/// La boîte d'un dialogue JavaScript, ou rien quand Electron répond aussitôt sans boîte
/// (`prompt` : refusé, la page reçoit `null`).
std::optional<MessageBox> javaScriptBox(JsKind kind, const std::string& message);

/// `confirm` vaut vrai pour le bouton 0 (« OK ») seulement ; `alert` ne rend rien d'utile.
bool javaScriptAccepted(JsKind kind, int response);

}  // namespace tentacle::dialogs
