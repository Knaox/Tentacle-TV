#pragma once
// Le saut RÉEL d'une requête déléguée, par la pile de Chromium : le nom est résolu par le
// résolveur de Chromium (`CefRequestContext::ResolveHost`, le même que celui de la requête, et
// son cache) ; une seule adresse privée et la requête est refusée (`refused`) — puis
// CefURLRequest sans cookie, sans cache, redirections RENDUES (jugées par `runClientFetch`).
//
// Écart avec Electron, écrit ici : Electron contrôle l'adresse DANS la résolution que la
// connexion emploie (`lookup` de Node) ; Chromium n'expose pas l'adresse jointe. Le contrôle
// précède donc la connexion, sur le même résolveur : un nom à TTL nul qui changerait de réponse
// entre les deux (« rebinding ») n'est pas exclu. Voir le rapport de l'axe reseau.

#include "net/client_fetch_run.h"

namespace tentacle::net::cf {

/// Depuis le fil principal ; rappel sur le fil UI de CEF (le principal).
Hop cefHop();

/// La résolution seule (sur le fil UI) : `ok` faux si le nom ne se résout pas ; `ips` sinon.
void resolveWithChromium(const std::string& host, std::function<void(bool ok, std::vector<std::string> ips)> done);

}  // namespace tentacle::net::cf
