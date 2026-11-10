#include "shell/client_popup.h"

#include <cstdio>
#include <map>

#include "shell/client.h"

namespace tentacle {
namespace popup {
namespace {

std::map<int, Handler>& handlers() {
  static std::map<int, Handler> h;
  return h;
}
std::map<int, std::function<void()>>& closingListeners() {
  static std::map<int, std::function<void()>> l;
  return l;
}
int g_next = 1;

}  // namespace

int addHandler(Handler handler) {
  const int id = g_next++;
  handlers()[id] = std::move(handler);
  return id;
}

void removeHandler(int id) { handlers().erase(id); }

bool route(const Request& request, CefWindowInfo& windowInfo, CefRefPtr<CefClient>& client,
           CefBrowserSettings& settings, CefRefPtr<CefDictionaryValue>& extraInfo,
           bool* noJavascriptAccess) {
  // Copie : un gestionnaire peut s'en aller pendant l'appel.
  const auto all = handlers();
  for (const auto& [_, handler] : all) {
    const Decision d = handler(request, windowInfo, client, settings, extraInfo);
    if (d == Decision::pass) continue;
    if (d == Decision::allow && noJavascriptAccess) *noJavascriptAccess = false;
    return d == Decision::deny;
  }
  // Pas de seconde fenêtre CEF sans un module qui la prenne : refusée (journalisée).
  std::fprintf(stderr, "[shell] popup refusée : %s\n", request.url.c_str());
  return true;
}

int addHostClosingListener(std::function<void()> listener) {
  const int id = g_next++;
  closingListeners()[id] = std::move(listener);
  return id;
}

void removeHostClosingListener(int id) { closingListeners().erase(id); }

void hostClosing() {
  const auto all = closingListeners();
  for (const auto& [_, listener] : all) listener();
}

}  // namespace popup

bool Client::OnBeforePopup(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                           int popupId, const CefString& targetUrl,
                           const CefString& targetFrameName, WindowOpenDisposition disposition,
                           bool userGesture, const CefPopupFeatures& features,
                           CefWindowInfo& windowInfo, CefRefPtr<CefClient>& client,
                           CefBrowserSettings& settings, CefRefPtr<CefDictionaryValue>& extraInfo,
                           bool* noJavascriptAccess) {
  popup::Request request{browser,     frame,       targetUrl.ToString(), targetFrameName.ToString(),
                         disposition, userGesture, &features};
  return popup::route(request, windowInfo, client, settings, extraInfo, noJavascriptAccess);
}

bool Client::DoClose(CefRefPtr<CefBrowser> browser) {
  // La fenêtre principale se ferme pour de bon : ses fenêtres (le PiP) partent avant elle,
  // pendant que sa page vit encore. Le comportement de fermeture reste celui de CEF.
  popup::hostClosing();
  return false;
}

}  // namespace tentacle
