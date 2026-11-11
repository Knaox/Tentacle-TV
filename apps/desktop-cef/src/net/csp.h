#pragma once
// Politiques de sécurité du contenu — portage de `apps/desktop-electron/src/main/csp.ts`, au
// caractère près.
//
//  - L'application (`tentacle://app`, et toute autre origine du schéma hors greffons) : SANS
//    `'unsafe-inline'` sur les scripts ; seules les empreintes SHA-256 des scripts inline
//    réellement présents dans `index.html` (le thème posé avant le premier paint) sont
//    admises, calculées au démarrage. Les origines voisines (`tentacle://local`,
//    `tentacle://art`, `tentacle://plugin`) y sont NOMMÉES : `'self'` ne les couvre pas.
//  - Le document d'un greffon (`tentacle://plugin/<id>`) : scripts inline et `eval` permis
//    (Tailwind à l'exécution), tout le reste fermé, encadrable par l'application seule.

#include <string>
#include <string_view>
#include <vector>

namespace tentacle::net::csp {

/// Empreintes des scripts inline (sans `src`) non vides, prêtes pour la CSP : `'sha256-…'`.
std::vector<std::string> inlineScriptHashes(std::string_view html);

/// Le HTML sans ses balises `<meta http-equiv="Content-Security-Policy">` (et le blanc qui les
/// précède) — ce que fait le build Electron (`stripCspMetaForElectron`, `apps/web/vite.config.ts`)
/// à `index.html`, fait ici AU SERVICE : la balise est celle de Tauri (son `frame-src` ne nomme
/// pas `tentacle://plugin`, ni `http:`), et deux politiques s'appliquent par INTERSECTION. Un
/// `apps/web/dist` construit sans `TENTACLE_SHELL=electron` (le build web ordinaire) refusait
/// donc l'iframe de toute page d'extension (« Ce contenu est bloqué »). L'en-tête (`buildAppCsp`)
/// est LA politique, comme sous Electron.
std::string stripCspMeta(std::string_view html);

/// `localOrigins` : les origines voisines nommées dans img-src et connect-src, séparées par
/// un espace (Electron : « tentacle://local tentacle://art »).
std::string buildAppCsp(const std::string& appOrigin, const std::string& pluginOrigin,
                        const std::string& localOrigins, const std::vector<std::string>& scriptHashes);
std::string buildPluginCsp(const std::string& appOrigin);

}  // namespace tentacle::net::csp
