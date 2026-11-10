#pragma once
// Les boîtes que la page fait naître — `<input type=file>`, `alert`/`confirm`/`prompt`,
// `beforeunload`, téléchargement — comme les traite le bureau Electron 43 (règle pure :
// `shell/dialog_rule.h` ; boîtes natives : `shell/native_dialogs.h`).
//
// Bancs : `TENTACLE_DEBUG_NAVIGATEUR=1` ouvre le canal `navigateur.debug.dialogs` (hors
// `window.tentacle`) — `{op:"state"}` rend les boîtes ouvertes et l'historique des demandes ;
// `{op:"answer", id, response}` répond à une boîte de message, `{op:"answer", id, paths:[…]}`
// ou `{op:"answer", id, cancel:true}` à un panneau de fichiers (la boîte native est fermée) ;
// `{op:"queue", answers:[{response|paths|cancel, afterMs}…]}` répond d'avance aux prochaines
// boîtes, après `afterMs` (un dialogue JavaScript bloque la page, donc le canal).

#include <SDL3/SDL.h>

#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <string>

#include "include/cef_dialog_handler.h"
#include "include/cef_download_handler.h"
#include "include/cef_jsdialog_handler.h"
#include "shell/json.h"
#include "shell/native_dialogs.h"

namespace tentacle {

class BrowserDialogs final : public CefDialogHandler,
                             public CefJSDialogHandler,
                             public CefDownloadHandler {
 public:
  explicit BrowserDialogs(SDL_Window* window);
  ~BrowserDialogs() override;
  // La fenêtre s'en va : les boîtes ouvertes se ferment, plus rien ne s'ouvre.
  void detach();

  // CefDialogHandler : `<input type=file>` (et l'enregistrement que demanderait la page).
  bool OnFileDialog(CefRefPtr<CefBrowser> browser, FileDialogMode mode, const CefString& title,
                    const CefString& defaultFilePath, const std::vector<CefString>& acceptFilters,
                    const std::vector<CefString>& acceptExtensions,
                    const std::vector<CefString>& acceptDescriptions,
                    CefRefPtr<CefFileDialogCallback> callback) override;

  // CefJSDialogHandler
  bool OnJSDialog(CefRefPtr<CefBrowser> browser, const CefString& originUrl,
                  JSDialogType dialogType, const CefString& messageText,
                  const CefString& defaultPromptText, CefRefPtr<CefJSDialogCallback> callback,
                  bool& suppressMessage) override;
  bool OnBeforeUnloadDialog(CefRefPtr<CefBrowser> browser, const CefString& messageText,
                            bool isReload, CefRefPtr<CefJSDialogCallback> callback) override;
  void OnResetDialogState(CefRefPtr<CefBrowser> browser) override;

  // CefDownloadHandler
  bool CanDownload(CefRefPtr<CefBrowser> browser, const CefString& url,
                   const CefString& requestMethod) override {
    return true;  // Electron laisse tout téléchargement aller jusqu'à sa boîte d'enregistrement
  }
  bool OnBeforeDownload(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDownloadItem> item,
                        const CefString& suggestedName,
                        CefRefPtr<CefBeforeDownloadCallback> callback) override;
  void OnDownloadUpdated(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDownloadItem> item,
                         CefRefPtr<CefDownloadItemCallback> callback) override;

 private:
  // Une boîte ouverte : sa forme (banc) et de quoi y répondre sans elle.
  struct Pending {
    std::unique_ptr<platform::NativeDialog> native;
    Json describe;
    std::function<void(const Json& answer)> answer;  // réponse du banc (boîte fermée d'abord)
    bool jsDialog = false;
  };
  int open(Json describe, bool jsDialog);
  void settle(int id);  // la boîte a répondu : elle n'est plus ouverte
  void attach(int id, std::unique_ptr<platform::NativeDialog> native);
  bool answerPending(int id, const Json& answer);
  void debug(const Json& payload, const std::function<void(Json)>& reply);

  SDL_Window* window_;
  std::map<int, Pending> pending_;
  std::deque<Json> history_;  // dernières demandes (banc)
  std::deque<Json> queued_;   // réponses d'avance (banc)
  int nextId_ = 1;
  bool detached_ = false;
  bool debugChannel_ = false;
  std::string lastDirectory_;          // `kSelectFileLastDirectory` d'Electron (session)
  std::string lastDownloadDirectory_;  // `last_saved_directory_` du délégué de téléchargement
  IMPLEMENT_REFCOUNTING(BrowserDialogs);
};

/// Dossier « Téléchargements » de l'utilisateur (`app.getPath('downloads')`).
std::string downloadsDirectory();

}  // namespace tentacle
