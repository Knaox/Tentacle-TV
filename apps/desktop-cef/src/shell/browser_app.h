#pragma once
// CefApp du processus navigateur : drapeaux Chromium et pompe de messages.

#include "include/cef_app.h"

namespace tentacle {

class MessagePump;

class BrowserApp final : public CefApp, public CefBrowserProcessHandler {
 public:
  explicit BrowserApp(MessagePump* pump) : pump_(pump) {}

  CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override { return this; }
  void OnBeforeCommandLineProcessing(const CefString& processType,
                                     CefRefPtr<CefCommandLine> commandLine) override;
  void OnScheduleMessagePumpWork(int64_t delayMs) override;

 private:
  MessagePump* pump_;
  IMPLEMENT_REFCOUNTING(BrowserApp);
};

}  // namespace tentacle
