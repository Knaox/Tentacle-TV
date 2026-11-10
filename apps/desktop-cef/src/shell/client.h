#pragma once
// CefClient de la fenêtre principale (rendu hors écran). Ne connaît ni SDL ni l'OS : il
// parle à un ViewHost (implémenté par Shell) et au WebLayer du compositeur.

#include "compositor/compositor.h"
#include "include/cef_client.h"
#include "include/cef_drag_handler.h"
#include "include/cef_dialog_handler.h"
#include "include/cef_download_handler.h"
#include "include/cef_jsdialog_handler.h"
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
  // navigateur : le curseur avec ce que CEF fournit en plus (natif, image de `cursor: url`) ;
  // par défaut, la forme seule (src/shell/cursors.h).
  virtual void setCursorFull(cef_cursor_type_t type, CefCursorHandle native,
                             const CefCursorInfo& custom) {
    setCursor(type);
  }
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
  // navigateur : boîtes de la page — fichiers, JavaScript, téléchargements
  // (src/shell/browser_dialogs.h). nullptr : le défaut de CEF.
  virtual CefRefPtr<CefDialogHandler> dialogHandler() { return nullptr; }
  virtual CefRefPtr<CefJSDialogHandler> jsDialogHandler() { return nullptr; }
  virtual CefRefPtr<CefDownloadHandler> downloadHandler() { return nullptr; }
  // navigateur : glisser-déposer rendu (src/shell/drag_drop.h).
  virtual bool startDragging(CefRefPtr<CefDragData> data, cef_drag_operations_mask_t allowed) {
    return false;
  }
  virtual void updateDragCursor(cef_drag_operations_mask_t operation) {}
  // navigateur : bulle d'aide (`title=`), texte vide = aucune (src/shell/tooltip.h).
  virtual void showTooltip(const std::string& text) {}
  // Le processus de rendu de la page est tombé (`cef_termination_status_t`, code et texte de
  // Chromium) : l'hôte recharge (shell/render_recovery.h).
  virtual void onRenderProcessGone(int status, int errorCode, const std::string& errorText) {}
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
                     public CefPermissionHandler,
                     public CefDragHandler {
 public:
  // CefLifeSpanHandler ET CefRequestHandler déclarent chacun ce nom : GCC (Linux) refuse la
  // référence ambiguë que Clang tolère. Un alias de la classe tranche, pour tous les fichiers.
  using WindowOpenDisposition = cef_window_open_disposition_t;
  // Même cas depuis que Client est aussi un CefDragHandler (régions, axe systeme) : le masque des
  // opérations de glisser est déclaré par lui ET par CefRenderHandler (StartDragging, navigateur).
  using DragOperationsMask = cef_drag_operations_mask_t;
  explicit Client(ViewHost* host) : host_(host) {}

  CefRefPtr<CefPermissionHandler> GetPermissionHandler() override { return this; }
  // CefPermissionHandler (navigateur, client_navigation.cpp) : tout refusé comme Electron,
  // sauf l'accès au réseau local pour tentacle://app seul.
  bool OnShowPermissionPrompt(CefRefPtr<CefBrowser> browser, uint64_t promptId,
                              const CefString& requestingOrigin, uint32_t requestedPermissions,
                              CefRefPtr<CefPermissionPromptCallback> callback) override;
  bool OnRequestMediaAccessPermission(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                      const CefString& requestingOrigin,
                                      uint32_t requestedPermissions,
                                      CefRefPtr<CefMediaAccessCallback> callback) override;

  // CefDragHandler (client_drag_regions.cpp, axe systeme) : les régions `app-region: drag` de
  // la page deviennent le test de clic de la fenêtre (déplacer la fenêtre, sur les trois OS).
  CefRefPtr<CefDragHandler> GetDragHandler() override { return this; }
  void OnDraggableRegionsChanged(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                 const std::vector<CefDraggableRegion>& regions) override;

  CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
  CefRefPtr<CefRenderHandler> GetRenderHandler() override { return this; }
  CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
  CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
  CefRefPtr<CefKeyboardHandler> GetKeyboardHandler() override { return this; }
  CefRefPtr<CefContextMenuHandler> GetContextMenuHandler() override { return this; }
  CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }
  // navigateur : objets à part, tenus par l'hôte (src/shell/browser_dialogs.h).
  CefRefPtr<CefDialogHandler> GetDialogHandler() override { return host_->dialogHandler(); }
  CefRefPtr<CefJSDialogHandler> GetJSDialogHandler() override { return host_->jsDialogHandler(); }
  CefRefPtr<CefDownloadHandler> GetDownloadHandler() override { return host_->downloadHandler(); }
  bool OnProcessMessageReceived(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                CefProcessId source,
                                CefRefPtr<CefProcessMessage> message) override;

  // CefLifeSpanHandler — OnBeforePopup et DoClose : client_popup.cpp (aiguillage par module ;
  // défaut = règle d'Electron, navigateur : dehors et refusée).
  bool DoClose(CefRefPtr<CefBrowser> browser) override;
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
  // navigateur (client_drag.cpp) : glisser-déposer HTML5 rejoué par l'hôte.
  bool StartDragging(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDragData> dragData,
                     DragOperationsMask allowedOps, int x, int y) override;
  void UpdateDragCursor(CefRefPtr<CefBrowser> browser, DragOperation operation) override;

  // CefDisplayHandler
  bool OnCursorChange(CefRefPtr<CefBrowser> browser, CefCursorHandle cursor,
                      cef_cursor_type_t type, const CefCursorInfo& custom) override;
  void OnTitleChange(CefRefPtr<CefBrowser> browser, const CefString& title) override;
  // navigateur (client_drag.cpp) : en rendu hors écran, l'hôte dessine la bulle.
  bool OnTooltip(CefRefPtr<CefBrowser> browser, CefString& text) override;
  bool OnConsoleMessage(CefRefPtr<CefBrowser> browser, cef_log_severity_t level,
                        const CefString& message, const CefString& source, int line) override;

  // CefLoadHandler
  void OnLoadError(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                   ErrorCode code, const CefString& text, const CefString& url) override;

  // CefKeyboardHandler : ce que la page n'a pas consommé repart vers les menus de l'app.
  bool OnKeyEvent(CefRefPtr<CefBrowser> browser, const CefKeyEvent& event,
                  CefEventHandle osEvent) override;

  void OnFullscreenModeChange(CefRefPtr<CefBrowser> browser, bool fullscreen) override;

  // CefRequestHandler (navigateur, client_navigation.cpp) : `will-navigate`, `will-redirect`,
  // ouvertures « nouvel onglet » d'Electron (`lockNavigation`).
  bool OnBeforeBrowse(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                      CefRefPtr<CefRequest> request, bool userGesture, bool isRedirect) override;
  bool OnOpenURLFromTab(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                        const CefString& targetUrl, WindowOpenDisposition disposition,
                        bool userGesture) override;

  // CefRequestHandler (shell_recovery.cpp) : la page perdue ou muette — rechargée, et dite au
  // journal. Sans cela, une page morte reste la dernière image reçue, ou noire.
  void OnRenderProcessTerminated(CefRefPtr<CefBrowser> browser, TerminationStatus status,
                                 int errorCode, const CefString& errorString) override;
  bool OnRenderProcessUnresponsive(CefRefPtr<CefBrowser> browser,
                                   CefRefPtr<CefUnresponsiveProcessCallback> callback) override;
  void OnRenderProcessResponsive(CefRefPtr<CefBrowser> browser) override;

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
  // Contrôles de permission refusés comme Electron (réglages de contenu par défaut).
  static void applyPermissionDefaults(CefRefPtr<CefBrowser> browser);
  ViewHost* host_;
  PopupRect popupDip_;
  bool popupVisible_ = false;
  bool closed_ = false;  // fil principal
  IMPLEMENT_REFCOUNTING(Client);
};

}  // namespace tentacle
