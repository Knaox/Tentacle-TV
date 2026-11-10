// Où la page a le droit d'aller, quelles fenêtres elle ouvre, quelles permissions elle reçoit :
// la politique d'Electron (`security.ts` : `lockNavigation`, `restrictPermissions`), appliquée
// au navigateur hors écran. Règle pure : `shell/navigation_rule.h`.

#include <cstdio>
#include <string>

#include "include/cef_request_context.h"
#include "shell/app_scheme.h"
#include "shell/client.h"
#include "shell/external_url.h"
#include "shell/navigation_rule.h"

namespace tentacle {
namespace nav {

void applyVerdict(Verdict verdict, const std::string& url, const char* what) {
  if (verdict == nav::Verdict::denyOpenExternal) {
    openExternalSafely(url);
  } else if (verdict == nav::Verdict::deny) {
    std::fprintf(stderr, "[nav] %s refusée : %s\n", what, url.c_str());
  }
}

}  // namespace nav

// `will-navigate` et `will-redirect`, cadre principal seulement : les cadres (bande-annonce,
// greffons) gardent leurs navigations, comme sous Electron.
bool Client::OnBeforeBrowse(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                            CefRefPtr<CefRequest> request, bool userGesture, bool isRedirect) {
  if (!frame->IsMain()) return false;
  const std::string url = request->GetURL().ToString();
  const nav::Verdict verdict = nav::mainFrameNavigation(url, isRedirect);
  if (verdict == nav::Verdict::allow) return false;
  nav::applyVerdict(verdict, url, isRedirect ? "redirection" : "navigation");
  return true;
}

// Clic du milieu, Ctrl/⌘ + clic, Maj + clic : Electron les reçoit dans `setWindowOpenHandler`
// (« background-tab », « new-window »…) et les envoie dehors. Le cas « même onglet » (passage
// à file://) revient à OnBeforeBrowse.
bool Client::OnOpenURLFromTab(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                              const CefString& targetUrl, WindowOpenDisposition disposition,
                              bool userGesture) {
  if (disposition == CEF_WOD_CURRENT_TAB) return false;
  const std::string url = targetUrl.ToString();
  nav::applyVerdict(nav::windowOpen(url), url, "fenêtre");
  return true;
}

// Electron refuse TOUTES les permissions web sauf l'écriture du presse-papiers par la page de
// l'application (`isGranted`). Ici, l'écriture assainie n'est jamais demandée par une invite
// (Chromium l'accorde à la page qui a le focus) : toute invite est donc refusée — refusée, pas
// ignorée, sans quoi `Notification.requestPermission()` resterait en attente pour toujours
// (mesuré : style Alloy, défaut IGNORE).
//
// Exceptions propres à CEF : l'accès au réseau local, pour tentacle://app seul, et les
// téléchargements multiples (ci-dessous). Chromium 156
// classe notre origine « publique » et soumet ces requêtes à la permission d'accès au réseau
// local ; en rendu hors écran, aucune invite ne s'affiche : la demande restait en attente et
// CHAQUE requête pendait (mesuré, banc sur 127.0.0.1 : « le serveur met trop de temps à
// répondre »). Accordée seulement quand la demande ne porte que sur le réseau local.
bool Client::OnShowPermissionPrompt(CefRefPtr<CefBrowser> browser, uint64_t promptId,
                                    const CefString& requestingOrigin,
                                    uint32_t requestedPermissions,
                                    CefRefPtr<CefPermissionPromptCallback> callback) {
  // L'ancien type unique (1 << 25, « _DEPRECATED » dans cette API) et les deux qui l'ont
  // remplacé : réseau local et machine même.
  constexpr uint32_t kLocalNetwork = CEF_PERMISSION_TYPE_LOCAL_NETWORK_ACCESS_DEPRECATED |
                                     CEF_PERMISSION_TYPE_LOCAL_NETWORK |
                                     CEF_PERMISSION_TYPE_LOOPBACK_NETWORK;
  std::string origin = requestingOrigin.ToString();
  if (!origin.empty() && origin.back() == '/') origin.pop_back();
  // Les « téléchargements multiples » : le limiteur de Chrome (`DownloadRequestLimiter`) n'existe
  // pas sous Electron, qui laisse chaque téléchargement aller à sa boîte d'enregistrement
  // (mesuré sous CEF : le second téléchargement d'une page était refusé ici, en silence).
  uint32_t granted = CEF_PERMISSION_TYPE_MULTIPLE_DOWNLOADS;
  if (origin == appscheme::kAppOrigin) granted |= kLocalNetwork;
  if (requestedPermissions != 0 && (requestedPermissions & ~granted) == 0) {
    callback->Continue(CEF_PERMISSION_RESULT_ACCEPT);
    return true;
  }
  std::fprintf(stderr, "[permission] refusée : %s (0x%x)\n", origin.c_str(),
               requestedPermissions);
  callback->Continue(CEF_PERMISSION_RESULT_DENY);
  return true;
}

// Caméra, micro, capture d'écran : refusés (Electron : « media » n'est pas dans `isGranted`).
bool Client::OnRequestMediaAccessPermission(CefRefPtr<CefBrowser> browser,
                                            CefRefPtr<CefFrame> frame,
                                            const CefString& requestingOrigin,
                                            uint32_t requestedPermissions,
                                            CefRefPtr<CefMediaAccessCallback> callback) {
  callback->Cancel();
  return true;
}

// `setPermissionCheckHandler` d'Electron répond « refusé » aux CONTRÔLES aussi
// (`navigator.permissions.query`, `Notification.permission`) : sous CEF ils disaient
// « prompt » et « default » (mesuré). Les réglages de contenu par défaut le disent ici, pour
// les permissions qu'une page peut interroger. L'écriture assainie du presse-papiers garde le
// défaut de Chromium (accordée), comme `isGranted`.
void Client::applyPermissionDefaults(CefRefPtr<CefBrowser> browser) {
  auto context = browser->GetHost()->GetRequestContext();
  if (!context) return;
  for (auto type : {CEF_CONTENT_SETTING_TYPE_NOTIFICATIONS, CEF_CONTENT_SETTING_TYPE_GEOLOCATION,
                    CEF_CONTENT_SETTING_TYPE_MEDIASTREAM_MIC,
                    CEF_CONTENT_SETTING_TYPE_MEDIASTREAM_CAMERA,
                    CEF_CONTENT_SETTING_TYPE_MIDI_SYSEX,
                    CEF_CONTENT_SETTING_TYPE_CLIPBOARD_READ_WRITE,
                    CEF_CONTENT_SETTING_TYPE_IDLE_DETECTION, CEF_CONTENT_SETTING_TYPE_LOCAL_FONTS,
                    CEF_CONTENT_SETTING_TYPE_WINDOW_MANAGEMENT}) {
    context->SetContentSetting("", "", type, CEF_CONTENT_SETTING_VALUE_BLOCK);
  }
}

}  // namespace tentacle
