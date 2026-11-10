#include "shell/client.h"

#include <cstdio>

#include "shell/ipc.h"
#include "shell/main_thread.h"

namespace tentacle {

bool Client::OnProcessMessageReceived(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                      CefProcessId source,
                                      CefRefPtr<CefProcessMessage> message) {
  return ipc::onProcessMessage(browser, frame, message);
}

void Client::OnAfterCreated(CefRefPtr<CefBrowser> browser) {
  applyPermissionDefaults(browser);
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
