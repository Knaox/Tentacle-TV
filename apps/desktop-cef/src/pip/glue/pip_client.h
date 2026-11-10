#pragma once
// Le navigateur du PiP : le popup `window.open("about:blank", "tentacle-pip")` de la page,
// rendu HORS ÉCRAN dans la pile de couches de la fenêtre PiP (sa couche web), au-dessus de la
// vidéo prêtée. La page qui l'a ouvert y écrit elle-même (portail React, même processus de
// rendu) : ce navigateur n'a ni `window.tentacle`, ni scripts injectés, ni canal IPC.

#include "compositor/compositor.h"
#include "include/cef_client.h"
#include "include/cef_request_handler.h"
#include "pip/pip_controller.h"

namespace tentacle::pip {

class PipClient final : public CefClient,
                        public CefLifeSpanHandler,
                        public CefRenderHandler,
                        public CefDisplayHandler,
                        public CefContextMenuHandler,
                        public CefRequestHandler {
 public:
  // CefLifeSpanHandler ET CefRequestHandler déclarent ce nom : GCC refuse la référence ambiguë.
  using WindowOpenDisposition = cef_window_open_disposition_t;
  explicit PipClient(Controller* controller) : controller_(controller) {}
  /// Le contrôleur s'en va (fermeture de l'app) : plus aucun rappel vers lui.
  void detach() { controller_ = nullptr; }

  CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
  CefRefPtr<CefRenderHandler> GetRenderHandler() override { return this; }
  CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
  CefRefPtr<CefContextMenuHandler> GetContextMenuHandler() override { return this; }
  CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }

  // CefRequestHandler : la page du PiP ne quitte jamais about:blank (`lockNavigation`).
  bool OnBeforeBrowse(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                      CefRefPtr<CefRequest> request, bool userGesture, bool isRedirect) override;

  // CefLifeSpanHandler
  bool OnBeforePopup(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame, int popupId,
                     const CefString& targetUrl, const CefString& targetFrameName,
                     WindowOpenDisposition disposition, bool userGesture,
                     const CefPopupFeatures& features, CefWindowInfo& windowInfo,
                     CefRefPtr<CefClient>& client, CefBrowserSettings& settings,
                     CefRefPtr<CefDictionaryValue>& extraInfo, bool* noJavascriptAccess) override;
  void OnAfterCreated(CefRefPtr<CefBrowser> browser) override;
  bool DoClose(CefRefPtr<CefBrowser> browser) override;
  void OnBeforeClose(CefRefPtr<CefBrowser> browser) override;

  // CefRenderHandler
  void GetViewRect(CefRefPtr<CefBrowser> browser, CefRect& rect) override;
  bool GetScreenInfo(CefRefPtr<CefBrowser> browser, CefScreenInfo& info) override;
  bool GetScreenPoint(CefRefPtr<CefBrowser> browser, int viewX, int viewY, int& screenX,
                      int& screenY) override;
  void OnPaint(CefRefPtr<CefBrowser> browser, PaintElementType type, const RectList& dirty,
               const void* buffer, int width, int height) override;
  void OnAcceleratedPaint(CefRefPtr<CefBrowser> browser, PaintElementType type,
                          const RectList& dirty, const CefAcceleratedPaintInfo& info) override;

  // CefDisplayHandler
  bool OnCursorChange(CefRefPtr<CefBrowser> browser, CefCursorHandle cursor,
                      cef_cursor_type_t type, const CefCursorInfo& custom) override;
  bool OnConsoleMessage(CefRefPtr<CefBrowser> browser, cef_log_severity_t level,
                        const CefString& message, const CefString& source, int line) override;

  // CefContextMenuHandler : pas de menu natif.
  void OnBeforeContextMenu(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                           CefRefPtr<CefContextMenuParams> params,
                           CefRefPtr<CefMenuModel> model) override {
    model->Clear();
  }

  CefRefPtr<CefBrowser> browser() const { return browser_; }

 private:
  void present(const tentacle::WebFrame& frame, PaintElementType type);

  Controller* controller_;
  CefRefPtr<CefBrowser> browser_;
  IMPLEMENT_REFCOUNTING(PipClient);
};

}  // namespace tentacle::pip
