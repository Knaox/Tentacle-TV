#pragma once
// Les popups de la page (`window.open`, `target=_blank`) : un aiguillage où chaque module
// inscrit SON cas (pip : la fenêtre PiP ; navigateur : liens externes…), et le refus par défaut.
//
// `Client::OnBeforePopup` (fil UI de CEF = fil principal) ne fait qu'appeler `route` : le
// premier gestionnaire qui ne rend pas `pass` décide. Aucun ne s'en charge → refusée et
// journalisée, comme avant. Un gestionnaire qui accepte remplit `windowInfo` (hors écran),
// `client`, `settings` et, s'il le faut, `extraInfo`.
//
// Même aiguillage pour la fermeture : `Client::DoClose` du navigateur PRINCIPAL appelle
// `hostClosing()` — la fenêtre principale se ferme POUR DE BON (une garde de sortie l'a déjà
// laissée partir) : les fenêtres qu'elle a ouvertes partent avant elle.

#include <functional>
#include <string>

#include "include/cef_client.h"

namespace tentacle::popup {

struct Request {
  CefRefPtr<CefBrowser> opener;
  CefRefPtr<CefFrame> frame;
  std::string url;
  std::string frameName;
  cef_window_open_disposition_t disposition = CEF_WOD_UNKNOWN;
  bool userGesture = false;
  const CefPopupFeatures* features = nullptr;
};

enum class Decision { pass, deny, allow };

using Handler = std::function<Decision(const Request&, CefWindowInfo& windowInfo,
                                       CefRefPtr<CefClient>& client, CefBrowserSettings& settings,
                                       CefRefPtr<CefDictionaryValue>& extraInfo)>;

/// Inscrit un gestionnaire (à l'init du module, fil principal). Rend un identifiant pour
/// `removeHandler`.
int addHandler(Handler handler);
void removeHandler(int id);

/// Appelé par `Client::OnBeforePopup` : rend la valeur de CEF (vrai = annulée).
bool route(const Request& request, CefWindowInfo& windowInfo, CefRefPtr<CefClient>& client,
           CefBrowserSettings& settings, CefRefPtr<CefDictionaryValue>& extraInfo,
           bool* noJavascriptAccess);

/// La fenêtre principale se ferme pour de bon : prévient les modules, dans l'ordre d'inscription.
int addHostClosingListener(std::function<void()> listener);
void removeHostClosingListener(int id);
void hostClosing();

}  // namespace tentacle::popup
