#pragma once
// CefClient de la fenêtre principale (rendu hors écran). Ne connaît ni SDL ni l'OS : il
// parle à un ViewHost (implémenté par Shell) et au WebLayer du compositeur.

#include "compositor/compositor.h"
#include "include/cef_client.h"
#include "include/cef_permission_handler.h"
#include "include/cef_request_handler.h"
#include "include/cef_resource_request_handler.h"

namespace tentacle {

class ViewHost {
 public:
  virtual ~ViewHost() = default;
  virtual void viewSizePt(int& width, int& height) = 0;  // taille de la vue en points (DIP)
  virtual float deviceScale() = 0;
  virtual WebLayer* webLayer() = 0;
  virtual void viewToScreen(int x, int y, int& sx, int& sy) = 0;
  virtual void setCursor(cef_cursor_type_t type) = 0;
  virtual void setTitle(const std::string& title) = 0;
  virtual void setImeRect(const CefRect& caretDip) = 0;
  virtual void onBrowserCreated(CefRefPtr<CefBrowser> browser) = 0;
  virtual void onBrowserClosed() = 0;
  // Une image de la page vient d'arriver (veille de l'horloge d'images).
  virtual void onPaint() {}
  // Touche que la page n'a pas consommée (raccourcis d'application, shell/app_menu.h).
  virtual bool onUnhandledKey(const CefKeyEvent& event) = 0;
  // La page entre en plein écran « document » (requestFullscreen) ou en sort.
  virtual void onDocumentFullscreen(bool fullscreen) = 0;
  // Une ressource a fini de charger (n'importe quel cadre, iframes comprises) : la page va
  // sans doute peindre. Appelé sur le fil principal.
  virtual void onResourceLoaded() {}
};

class Client final : public CefClient,
                     public CefLifeSpanHandler,
                     public CefRenderHandler,
                     public CefDisplayHandler,
                     public CefLoadHandler,
                     public CefKeyboardHandler,
                     public CefContextMenuHandler,
                     public CefRequestHandler,
                     public CefResourceRequestHandler,
                     public CefPermissionHandler {
 public:
  explicit Client(ViewHost* host) : host_(host) {}

  CefRefPtr<CefPermissionHandler> GetPermissionHandler() override { return this; }
  // CefPermissionHandler : l'accès au réseau local, pour tentacle://app seul (client.cpp).
  bool OnShowPermissionPrompt(CefRefPtr<CefBrowser> browser, uint64_t promptId,
                              const CefString& requestingOrigin, uint32_t requestedPermissions,
                              CefRefPtr<CefPermissionPromptCallback> callback) override;

  CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
  CefRefPtr<CefRenderHandler> GetRenderHandler() override { return this; }
  CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
  CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
  CefRefPtr<CefKeyboardHandler> GetKeyboardHandler() override { return this; }
  CefRefPtr<CefContextMenuHandler> GetContextMenuHandler() override { return this; }
  CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }
  bool OnProcessMessageReceived(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                CefProcessId source,
                                CefRefPtr<CefProcessMessage> message) override;

  // CefLifeSpanHandler
  bool OnBeforePopup(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame, int popupId,
                     const CefString& targetUrl, const CefString& targetFrameName,
                     WindowOpenDisposition disposition, bool userGesture,
                     const CefPopupFeatures& features, CefWindowInfo& windowInfo,
                     CefRefPtr<CefClient>& client, CefBrowserSettings& settings,
                     CefRefPtr<CefDictionaryValue>& extraInfo, bool* noJavascriptAccess) override;
  void OnAfterCreated(CefRefPtr<CefBrowser> browser) override;
  void OnBeforeClose(CefRefPtr<CefBrowser> browser) override;

  // CefRenderHandler (client_render.cpp)
  void GetViewRect(CefRefPtr<CefBrowser> browser, CefRect& rect) override;
  bool GetScreenInfo(CefRefPtr<CefBrowser> browser, CefScreenInfo& info) override;
  bool GetScreenPoint(CefRefPtr<CefBrowser> browser, int viewX, int viewY, int& screenX,
                      int& screenY) override;
  void OnPopupShow(CefRefPtr<CefBrowser> browser, bool show) override;
  void OnPopupSize(CefRefPtr<CefBrowser> browser, const CefRect& rect) override;
  void OnPaint(CefRefPtr<CefBrowser> browser, PaintElementType type, const RectList& dirty,
               const void* buffer, int width, int height) override;
  void OnAcceleratedPaint(CefRefPtr<CefBrowser> browser, PaintElementType type,
                          const RectList& dirty, const CefAcceleratedPaintInfo& info) override;
  void OnImeCompositionRangeChanged(CefRefPtr<CefBrowser> browser, const CefRange& range,
                                    const RectList& characterBounds) override;

  // CefDisplayHandler
  bool OnCursorChange(CefRefPtr<CefBrowser> browser, CefCursorHandle cursor,
                      cef_cursor_type_t type, const CefCursorInfo& custom) override;
  void OnTitleChange(CefRefPtr<CefBrowser> browser, const CefString& title) override;
  bool OnConsoleMessage(CefRefPtr<CefBrowser> browser, cef_log_severity_t level,
                        const CefString& message, const CefString& source, int line) override;

  // CefLoadHandler
  void OnLoadError(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                   ErrorCode code, const CefString& text, const CefString& url) override;

  // CefKeyboardHandler : ce que la page n'a pas consommé repart vers les menus de l'app.
  bool OnKeyEvent(CefRefPtr<CefBrowser> browser, const CefKeyEvent& event,
                  CefEventHandle osEvent) override;

  void OnFullscreenModeChange(CefRefPtr<CefBrowser> browser, bool fullscreen) override;

  // CefRequestHandler / CefResourceRequestHandler : seulement la fin des chargements, pour
  // réveiller l'horloge d'images en veille (iframes comprises, où le script de réveil de la
  // page n'est pas injecté — shell/frame_wake.h).
  CefRefPtr<CefResourceRequestHandler> GetResourceRequestHandler(
      CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame, CefRefPtr<CefRequest> request,
      bool isNavigation, bool isDownload, const CefString& requestInitiator,
      bool& disableDefaultHandling) override {
    return this;
  }
  void OnResourceLoadComplete(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                              CefRefPtr<CefRequest> request, CefRefPtr<CefResponse> response,
                              URLRequestStatus status, int64_t receivedContentLength) override;

  // CefContextMenuHandler : pas de menu natif (le front a les siens).
  void OnBeforeContextMenu(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                           CefRefPtr<CefContextMenuParams> params,
                           CefRefPtr<CefMenuModel> model) override;

 private:
  ViewHost* host_;
  PopupRect popupDip_;
  bool popupVisible_ = false;
  bool closed_ = false;  // fil principal
  IMPLEMENT_REFCOUNTING(Client);
};

}  // namespace tentacle
