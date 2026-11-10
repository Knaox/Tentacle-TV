#pragma once
// La seule fenêtre que la page ouvre elle-même : le PiP (axe pip). Comme
// `setWindowOpenHandler` d'Electron (`lockNavigation(contents, pipWindowOpen)`), la demande
// est d'abord proposée au PiP ; s'il ne la prend pas, elle part dans le navigateur du système
// et la fenêtre est refusée (`shell/client_navigation.cpp`).

#include <functional>
#include <string>

#include "include/cef_client.h"

namespace tentacle::nav {

struct PopupRequest {
  std::string url;         // `targetUrl` (souvent vide pour un PiP : `window.open("", nom, …)`)
  std::string frameName;   // nom de la fenêtre (`targetFrameName`)
  cef_window_open_disposition_t disposition;
  bool userGesture = false;
  const CefPopupFeatures* features = nullptr;
};

/// Rend vrai pour PRENDRE la fenêtre : CEF la crée alors avec `windowInfo`, `client` et
/// `settings` tels que la fonction les a remplis. Faux : la règle d'Electron s'applique.
using PopupClaim = std::function<bool(const PopupRequest& request, CefWindowInfo& windowInfo,
                                      CefRefPtr<CefClient>& client, CefBrowserSettings& settings,
                                      CefRefPtr<CefDictionaryValue>& extraInfo)>;

/// Fil principal, avant la première fenêtre demandée ; une seule à la fois (la dernière gagne).
void setPopupClaim(PopupClaim claim);
const PopupClaim& popupClaim();

}  // namespace tentacle::nav
