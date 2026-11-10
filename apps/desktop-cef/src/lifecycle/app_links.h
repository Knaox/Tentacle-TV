#pragma once
// Les liens `tentacle://octave/<page>` remis par le SYSTÈME (`appLinks.ts` d'Electron, porté à
// l'identique) : une playlist partagée, la page d'ouverture d'un serveur, « Ouvrir dans l'app ».
//
// Trois arrivées : macOS (Apple event GetURL, à écouter AVANT le lancement, sinon le lien du
// lancement est perdu) ; Windows et Linux la ligne de commande, au lancement ou par la seconde
// instance. Le natif ne fait que TRANSMETTRE le lien brut, borné, à la page : la liste des pages
// qu'un lien peut ouvrir vit dans la règle partagée (`octaveOpenTarget`), appliquée par la page.
// Le lien du lancement attend que la page le demande (`app_link_take`).

#include <cstddef>
#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace tentacle::lifecycle {

/// Le seul hôte du schéma qui vienne du système (`tentacle://app` est l'origine de la page).
inline constexpr std::string_view kAppLinkPrefix = "tentacle://octave/";
inline constexpr size_t kAppLinkMaxLength = 8192;
/// L'évènement de la page (`window.tentacle.on("app-link")`).
inline constexpr const char* kAppLinkEvent = "app-link";

/// Le lien d'app d'une valeur reçue du système ; rien pour tout autre.
std::optional<std::string> appLinkOf(std::string_view raw);
/// Le lien d'une ligne de commande (Windows, Linux : le système le passe en argument).
std::optional<std::string> appLinkFromArgv(const std::vector<std::string>& argv);

/// La page, vue du natif.
struct AppLinkPage {
  /// Une page existe et a fini de charger (elle écoute `app-link`).
  std::function<bool()> ready;
  std::function<void(const std::string& link)> send;
  /// Restaure la fenêtre si elle est réduite, et lui donne le focus.
  std::function<void()> focus;
};

class AppLinks {
 public:
  /// Remet un lien à la page : tout de suite si elle écoute, sinon au moment où elle le
  /// demandera. Faux si ce n'est pas un lien d'app.
  bool deliver(std::string_view raw, const AppLinkPage& page);
  /// Le lien du lancement (ligne de commande), gardé pour `app_link_take`.
  void keepLaunchLink(const std::vector<std::string>& argv);
  /// `app_link_take` : le lien en attente, une seule fois.
  std::optional<std::string> take();

 private:
  std::optional<std::string> pending_;
};

}  // namespace tentacle::lifecycle
