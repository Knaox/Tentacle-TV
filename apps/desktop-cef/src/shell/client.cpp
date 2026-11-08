#include "shell/client.h"

#include <cstdio>

#include "shell/app_scheme.h"
#include "shell/ipc.h"
#include "shell/main_thread.h"

namespace tentacle {

bool Client::OnProcessMessageReceived(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                      CefProcessId source,
                                      CefRefPtr<CefProcessMessage> message) {
  return ipc::onProcessMessage(browser, frame, message);
}

bool Client::OnBeforePopup(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                           int popupId, const CefString& targetUrl,
                           const CefString& targetFrameName, WindowOpenDisposition disposition,
                           bool userGesture, const CefPopupFeatures& features,
                           CefWindowInfo& windowInfo, CefRefPtr<CefClient>& client,
                           CefBrowserSettings& settings, CefRefPtr<CefDictionaryValue>& extraInfo,
                           bool* noJavascriptAccess) {
  // Pas de seconde fenêtre CEF : window.open / target=_blank est refusé (journalisé).
  std::fprintf(stderr, "[shell] popup refusée : %s\n", targetUrl.ToString().c_str());
  return true;
}

// Le front embarqué (tentacle://app) parle à SON serveur et à Jellyfin, souvent sur le réseau
// local ou sur la machine même. Chromium 156 classe notre origine « publique » et soumet ces
// requêtes à la permission d'accès au réseau local ; en rendu hors écran, aucune invite ne
// s'affiche : la demande restait en attente et CHAQUE requête pendait (mesuré, banc sur
// 127.0.0.1 : « le serveur met trop de temps à répondre »). Accordée à tentacle://app seul, et
// seulement quand la demande ne porte que sur le réseau local ; toute autre demande garde le
// traitement par défaut de CEF. (Electron, `security.ts`, n'accorde que le presse-papiers.)
bool Client::OnShowPermissionPrompt(CefRefPtr<CefBrowser> browser, uint64_t promptId,
                                    const CefString& requestingOrigin,
                                    uint32_t requestedPermissions,
                                    CefRefPtr<CefPermissionPromptCallback> callback) {
  // L'ancien type unique (1 << 25, « _DEPRECATED » dans cette API) et les deux qui l'ont
  // remplacé : réseau local et machine même.
  constexpr uint32_t kLocalNetwork = CEF_PERMISSION_TYPE_LOCAL_NETWORK_ACCESS_DEPRECATED |
                                     CEF_PERMISSION_TYPE_LOCAL_NETWORK |
                                     CEF_PERMISSION_TYPE_LOOPBACK_NETWORK;
  std::string origin = requestingOrigin.ToString();
  if (!origin.empty() && origin.back() == '/') origin.pop_back();
  if (origin != appscheme::kAppOrigin || requestedPermissions == 0 ||
      (requestedPermissions & ~kLocalNetwork) != 0) {
    return false;
  }
  callback->Continue(CEF_PERMISSION_RESULT_ACCEPT);
  return true;
}

void Client::OnAfterCreated(CefRefPtr<CefBrowser> browser) {
  ipc::attachBrowser(browser);
  host_->onBrowserCreated(browser);
}

void Client::OnBeforeClose(CefRefPtr<CefBrowser> browser) {
  closed_ = true;
  ipc::detachBrowser(browser);
  host_->onBrowserClosed();
}

void Client::OnResourceLoadComplete(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                    CefRefPtr<CefRequest> request,
                                    CefRefPtr<CefResponse> response, URLRequestStatus status,
                                    int64_t receivedContentLength) {
  // Fil IO de CEF → fil principal ; rien après la fermeture du navigateur (le Shell part).
  CefRefPtr<Client> self(this);
  postToMain([self] {
    if (!self->closed_) self->host_->onResourceLoaded();
  });
}

bool Client::OnCursorChange(CefRefPtr<CefBrowser> browser, CefCursorHandle cursor,
                            cef_cursor_type_t type, const CefCursorInfo& custom) {
  host_->setCursor(type);
  return true;  // nous gérons le curseur (OSR : CEF ne touche pas à la fenêtre)
}

void Client::OnTitleChange(CefRefPtr<CefBrowser> browser, const CefString& title) {
  host_->setTitle(title.ToString());
}

bool Client::OnConsoleMessage(CefRefPtr<CefBrowser> browser, cef_log_severity_t level,
                              const CefString& message, const CefString& source, int line) {
  std::fprintf(stderr, "[page] %s (%s:%d)\n", message.ToString().c_str(),
               source.ToString().c_str(), line);
  return false;
}

void Client::OnLoadError(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                         ErrorCode code, const CefString& text, const CefString& url) {
  if (code == ERR_ABORTED) return;
  std::fprintf(stderr, "[shell] échec de chargement %d %s : %s\n", (int)code,
               text.ToString().c_str(), url.ToString().c_str());
}

bool Client::OnKeyEvent(CefRefPtr<CefBrowser> browser, const CefKeyEvent& event,
                        CefEventHandle osEvent) {
  return host_->onUnhandledKey(event);
}

void Client::OnFullscreenModeChange(CefRefPtr<CefBrowser> browser, bool fullscreen) {
  host_->onDocumentFullscreen(fullscreen);
}

void Client::OnBeforeContextMenu(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                 CefRefPtr<CefContextMenuParams> params,
                                 CefRefPtr<CefMenuModel> model) {
  model->Clear();
}

}  // namespace tentacle
