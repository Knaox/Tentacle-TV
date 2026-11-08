#include "shell/renderer_app.h"

#include "shell/app_scheme.h"
#include "shell/renderer_ipc.h"

namespace tentacle {
namespace {

class HelperApp final : public CefApp, public CefRenderProcessHandler {
 public:
  CefRefPtr<CefRenderProcessHandler> GetRenderProcessHandler() override { return this; }
  // Tous les helpers (rendu, GPU, réseau…) : la même déclaration que le principal.
  void OnRegisterCustomSchemes(CefRawPtr<CefSchemeRegistrar> registrar) override {
    appscheme::registerScheme(registrar);
  }

  // extra_info vient de CreateBrowser (processus navigateur) : c'est le seul canal qui
  // arrive dans CHAQUE nouveau processus de rendu avant la création du contexte JS —
  // y compris après une navigation qui change de processus.
  void OnBrowserCreated(CefRefPtr<CefBrowser> browser,
                        CefRefPtr<CefDictionaryValue> extraInfo) override {
    renderer::rememberScripts(browser, extraInfo);
  }
  void OnBrowserDestroyed(CefRefPtr<CefBrowser> browser) override {
    renderer::forgetBrowser(browser);
  }
  void OnContextCreated(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                        CefRefPtr<CefV8Context> context) override {
    renderer::installShell(browser, frame, context);
  }
  void OnContextReleased(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                         CefRefPtr<CefV8Context> context) override {
    renderer::releaseShell(frame);
  }
  bool OnProcessMessageReceived(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                CefProcessId source,
                                CefRefPtr<CefProcessMessage> message) override {
    return renderer::onProcessMessage(frame, message);
  }

 private:
  IMPLEMENT_REFCOUNTING(HelperApp);
};

}  // namespace

CefRefPtr<CefApp> createHelperApp() { return new HelperApp(); }

}  // namespace tentacle
