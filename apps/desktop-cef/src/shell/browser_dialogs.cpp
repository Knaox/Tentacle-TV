#include "shell/browser_dialogs.h"

#include <cstdio>
#include <cstdlib>

#include "shell/ipc.h"
#include "shell/main_thread.h"

namespace tentacle {
namespace {

constexpr char kDebugChannel[] = "navigateur.debug.dialogs";
constexpr size_t kHistory = 20;

std::vector<std::string> strings(const std::vector<CefString>& in) {
  std::vector<std::string> out;
  out.reserve(in.size());
  for (const auto& s : in) out.push_back(s.ToString());
  return out;
}

const char* modeName(dialogs::FileMode m) {
  switch (m) {
    case dialogs::FileMode::open: return "open";
    case dialogs::FileMode::openMultiple: return "openMultiple";
    case dialogs::FileMode::openFolder: return "openFolder";
    case dialogs::FileMode::save: return "save";
  }
  return "?";
}

Json describeFile(const dialogs::FileRequest& r, const char* origin) {
  Json filters = Json::array();
  for (const auto& f : r.filters) filters.push_back({{"name", f.name}, {"extensions", f.extensions}});
  return {{"kind", "file"}, {"origin", origin}, {"mode", modeName(r.mode)}, {"title", r.title},
          {"defaultPath", r.defaultPath}, {"filters", filters},
          {"createDirectory", r.createDirectory},
          {"treatPackageAsDirectory", r.treatPackageAsDirectory}};
}

std::string basename(const std::string& path) {
  const size_t cut = path.find_last_of("/\\");
  return cut == std::string::npos ? path : path.substr(cut + 1);
}

}  // namespace

std::string downloadsDirectory() {
  const char* dir = SDL_GetUserFolder(SDL_FOLDER_DOWNLOADS);
  return dir ? dir : "";
}

BrowserDialogs::BrowserDialogs(SDL_Window* window) : window_(window) {
  const char* env = std::getenv("TENTACLE_DEBUG_NAVIGATEUR");
  debugChannel_ = env && *env && *env != '0';
  if (!debugChannel_) return;
  CefRefPtr<BrowserDialogs> self(this);
  ipc::registerHandler(kDebugChannel, [self](const Json& payload, ipc::Responder r) {
    self->debug(payload, [r](Json v) { r.reply(std::move(v)); });
  });
}

BrowserDialogs::~BrowserDialogs() = default;

void BrowserDialogs::detach() {
  if (detached_) return;
  detached_ = true;
  if (debugChannel_) ipc::unregisterHandler(kDebugChannel);
  for (auto& [_, p] : pending_) {
    if (p.native) p.native->dismiss();
  }
  pending_.clear();
}

int BrowserDialogs::open(Json describe, bool jsDialog) {
  const int id = nextId_++;
  describe["id"] = id;
  history_.push_back(describe);
  if (history_.size() > kHistory) history_.pop_front();
  std::fprintf(stderr, "[dialogue] %s\n", describe.dump().c_str());
  Pending& p = pending_[id];
  p.describe = std::move(describe);
  p.jsDialog = jsDialog;
  // Banc : une réponse mise en file AVANT la boîte (la page est bloquée tant qu'elle est
  // ouverte : le canal ne la joint plus), rendue après `afterMs` — de quoi constater la boîte.
  if (!queued_.empty()) {
    Json a = queued_.front();
    queued_.pop_front();
    CefRefPtr<BrowserDialogs> self(this);
    postToMainDelayed([self, id, a] { self->answerPending(id, a); }, a.value("afterMs", 0));
  }
  return id;
}

bool BrowserDialogs::answerPending(int id, const Json& a) {
  auto it = pending_.find(id);
  if (it == pending_.end()) return false;
  if (it->second.native) it->second.native->dismiss();
  const auto answer = it->second.answer;  // copie : la réponse retire l'entrée
  if (answer) answer(a);
  return true;
}

void BrowserDialogs::settle(int id) { pending_.erase(id); }

void BrowserDialogs::attach(int id, std::unique_ptr<platform::NativeDialog> native) {
  // La boîte a pu répondre avant d'être rangée (échec à l'ouverture) : rien à garder.
  if (auto it = pending_.find(id); it != pending_.end()) it->second.native = std::move(native);
}

bool BrowserDialogs::OnFileDialog(CefRefPtr<CefBrowser> browser, FileDialogMode mode,
                                  const CefString& title, const CefString& defaultFilePath,
                                  const std::vector<CefString>& acceptFilters,
                                  const std::vector<CefString>& acceptExtensions,
                                  const std::vector<CefString>& acceptDescriptions,
                                  CefRefPtr<CefFileDialogCallback> callback) {
  if (detached_) return false;
  // Linux : la boîte de Chromium (portail XDG, sinon GTK) est celle d'Electron.
  if (!platform::hasNativeFileDialog()) return false;
  using dialogs::FileMode;
  FileMode m = FileMode::open;
  if (mode == FILE_DIALOG_OPEN_MULTIPLE) m = FileMode::openMultiple;
  else if (mode == FILE_DIALOG_OPEN_FOLDER) m = FileMode::openFolder;
  else if (mode == FILE_DIALOG_SAVE) m = FileMode::save;
  auto filters = dialogs::filtersFromAccept(strings(acceptFilters), strings(acceptExtensions));
  // Electron n'emploie que le NOM proposé par la page (`default_file_name`, vide pour un
  // `<input type=file>`), joint à SON dernier dossier ; CEF y préfixe un dossier à lui (mesuré :
  // le dossier personnel), écarté ici.
  const std::string defaultName = m == FileMode::save ? basename(defaultFilePath) : "";
  const auto request = dialogs::webFileChooser(m, title.ToString(), defaultName, lastDirectory_,
                                               std::move(filters));
  const int id = open(describeFile(request, "page"), false);

  CefRefPtr<BrowserDialogs> self(this);
  auto finish = [self, id, callback](std::optional<std::vector<std::string>> paths) {
    if (!self->pending_.count(id)) return;
    self->settle(id);
    if (!paths || paths->empty()) {
      callback->Cancel();
      return;
    }
    self->lastDirectory_ = dialogs::dirName(paths->front());
    callback->Continue(std::vector<CefString>(paths->begin(), paths->end()));
  };
  pending_[id].answer = [finish](const Json& a) {
    if (a.value("cancel", false) || !a.contains("paths")) return finish(std::nullopt);
    finish(a["paths"].get<std::vector<std::string>>());
  };
  attach(id, platform::showFileDialog(window_, request, finish));
  return true;
}

bool BrowserDialogs::OnJSDialog(CefRefPtr<CefBrowser> browser, const CefString& originUrl,
                                JSDialogType dialogType, const CefString& messageText,
                                const CefString& defaultPromptText,
                                CefRefPtr<CefJSDialogCallback> callback, bool& suppressMessage) {
  using dialogs::JsKind;
  const JsKind kind = dialogType == JSDIALOGTYPE_CONFIRM ? JsKind::confirm
                      : dialogType == JSDIALOGTYPE_PROMPT ? JsKind::prompt
                                                          : JsKind::alert;
  const auto box = dialogs::javaScriptBox(kind, messageText.ToString());
  if (!box || detached_) {
    // `prompt` : Electron répond aussitôt « annulé », la page reçoit `null`.
    std::fprintf(stderr, "[dialogue] prompt sans boîte (comme Electron) : null\n");
    callback->Continue(false, "");
    return true;
  }
  const int id = open({{"kind", kind == JsKind::alert ? "alert" : "confirm"},
                       {"message", box->message}, {"buttons", box->buttons},
                       {"defaultId", box->defaultId}, {"cancelId", box->cancelId},
                       {"origin", originUrl.ToString()}},
                      true);
  CefRefPtr<BrowserDialogs> self(this);
  auto finish = [self, id, kind, callback](int response) {
    if (!self->pending_.count(id)) return;
    self->settle(id);
    callback->Continue(dialogs::javaScriptAccepted(kind, response), "");
  };
  pending_[id].answer = [finish, cancelId = box->cancelId](const Json& a) {
    finish(a.value("response", cancelId));
  };
  attach(id, platform::showMessageBox(window_, *box, finish));
  return true;
}

// `will-prevent-unload` sans écouteur (le cas de Tentacle) : Electron garde la page, sans
// rien demander. Le front le sait (`useUnsavedGuard` : jamais de `beforeunload` annulé sur le
// bureau) ; une fermeture de la fenêtre (CloseBrowser forcé) ne passe pas par ici.
bool BrowserDialogs::OnBeforeUnloadDialog(CefRefPtr<CefBrowser> browser,
                                          const CefString& messageText, bool isReload,
                                          CefRefPtr<CefJSDialogCallback> callback) {
  std::fprintf(stderr, "[dialogue] beforeunload : la page reste (comme Electron)\n");
  history_.push_back({{"kind", "beforeunload"}, {"isReload", isReload}});
  if (history_.size() > kHistory) history_.pop_front();
  callback->Continue(false, "");
  return true;
}

void BrowserDialogs::OnResetDialogState(CefRefPtr<CefBrowser> browser) {
  // Navigation : CEF abandonne les dialogues JavaScript en cours ; leurs boîtes partent aussi.
  for (auto it = pending_.begin(); it != pending_.end();) {
    if (it->second.jsDialog) {
      if (it->second.native) it->second.native->dismiss();
      it = pending_.erase(it);
    } else {
      ++it;
    }
  }
}

bool BrowserDialogs::OnBeforeDownload(CefRefPtr<CefBrowser> browser,
                                      CefRefPtr<CefDownloadItem> item,
                                      const CefString& suggestedName,
                                      CefRefPtr<CefBeforeDownloadCallback> callback) {
  if (detached_) return false;
  const std::string dir =
      lastDownloadDirectory_.empty() ? downloadsDirectory() : lastDownloadDirectory_;
  const auto request = dialogs::downloadSave(item->GetURL().ToString(), dir,
                                             suggestedName.ToString());
  if (!platform::hasNativeFileDialog()) {
    // Linux : la boîte d'enregistrement de Chromium, proposée au même endroit.
    callback->Continue(request.defaultPath, true);
    return true;
  }
  const int id = open(describeFile(request, "download"), false);
  CefRefPtr<BrowserDialogs> self(this);
  // Annulée : le rappel n'est jamais exécuté, CEF annule le téléchargement (`item->Cancel`
  // d'Electron).
  auto finish = [self, id, callback](std::optional<std::vector<std::string>> paths) {
    if (!self->pending_.count(id)) return;
    self->settle(id);
    if (!paths || paths->empty()) return;
    self->lastDownloadDirectory_ = dialogs::dirName(paths->front());
    callback->Continue(paths->front(), false);
  };
  pending_[id].answer = [finish](const Json& a) {
    if (a.value("cancel", false) || !a.contains("paths")) return finish(std::nullopt);
    finish(a["paths"].get<std::vector<std::string>>());
  };
  attach(id, platform::showFileDialog(window_, request, finish));
  return true;
}

void BrowserDialogs::OnDownloadUpdated(CefRefPtr<CefBrowser> browser,
                                       CefRefPtr<CefDownloadItem> item,
                                       CefRefPtr<CefDownloadItemCallback> callback) {
  if (item->IsComplete()) {
    std::fprintf(stderr, "[téléchargement] fini : %s\n", item->GetFullPath().ToString().c_str());
  } else if (item->IsCanceled() || item->IsInterrupted()) {
    std::fprintf(stderr, "[téléchargement] %s : %s\n", item->IsCanceled() ? "annulé" : "interrompu",
                 item->GetURL().ToString().c_str());
  }
}

void BrowserDialogs::debug(const Json& payload, const std::function<void(Json)>& reply) {
  const std::string op = payload.value("op", "state");
  if (op == "answer") {
    int id = payload.value("id", 0);
    if (id == 0 && !pending_.empty()) id = pending_.rbegin()->first;
    const bool ok = answerPending(id, payload);
    return reply({{"ok", ok}, {"id", id}});
  }
  if (op == "queue") {
    for (const auto& a : payload.value("answers", Json::array())) queued_.push_back(a);
    return reply({{"queued", queued_.size()}});
  }
  Json open = Json::array();
  for (const auto& [_, p] : pending_) open.push_back(p.describe);
  Json history = Json::array();
  for (const auto& h : history_) history.push_back(h);
  reply({{"open", open}, {"history", history}});
}

}  // namespace tentacle
