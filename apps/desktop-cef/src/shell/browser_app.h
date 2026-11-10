#pragma once
// CefApp du processus navigateur : drapeaux Chromium et pompe de messages.

#include <functional>
#include <string>
#include <vector>

#include "include/cef_app.h"

namespace tentacle {

// Instance unique (axe systeme, `claimSingleInstance` d'Electron) : une autre instance lancée sur
// le même profil (root_cache_path) nous a transmis sa ligne de commande, puis est sortie. Fil
// principal. Sans gestionnaire, la relance est quand même absorbée (jamais de fenêtre Chrome).
void setSecondInstanceHandler(std::function<void(const std::vector<std::string>& argv)> handler);

class MessagePump;

class BrowserApp final : public CefApp, public CefBrowserProcessHandler {
 public:
  explicit BrowserApp(MessagePump* pump) : pump_(pump) {}

  CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override { return this; }
  void OnRegisterCustomSchemes(CefRawPtr<CefSchemeRegistrar> registrar) override;
  void OnBeforeCommandLineProcessing(const CefString& processType,
                                     CefRefPtr<CefCommandLine> commandLine) override;
  void OnScheduleMessagePumpWork(int64_t delayMs) override;
  bool OnAlreadyRunningAppRelaunch(CefRefPtr<CefCommandLine> commandLine,
                                   const CefString& currentDirectory) override;

 private:
  MessagePump* pump_;
  IMPLEMENT_REFCOUNTING(BrowserApp);
};

}  // namespace tentacle
