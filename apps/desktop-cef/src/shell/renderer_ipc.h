#pragma once
// Côté rendu de la plomberie IPC (processus helper « Renderer »).

#include "include/cef_browser.h"
#include "include/cef_process_message.h"
#include "include/cef_v8.h"
#include "include/cef_values.h"

namespace tentacle::renderer {

void rememberScripts(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDictionaryValue> extraInfo);
void forgetBrowser(CefRefPtr<CefBrowser> browser);
void installShell(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                  CefRefPtr<CefV8Context> context);
void releaseShell(CefRefPtr<CefFrame> frame, CefRefPtr<CefV8Context> context);
bool onProcessMessage(CefRefPtr<CefFrame> frame, CefRefPtr<CefProcessMessage> message);

}  // namespace tentacle::renderer
