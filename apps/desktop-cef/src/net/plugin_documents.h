#pragma once
// Documents des greffons, servis sous une origine à eux — portage de
// `apps/desktop-electron/src/main/pluginDocuments.ts` et `ipc/plugins.ts`.
//
// Un greffon est un document fait ENTIÈREMENT de scripts inline (Tailwind, dépendances
// partagées, pont `postMessage`). En `srcdoc`, il hériterait de la CSP de l'application, qui
// n'admet que les empreintes d'`index.html`. Déposé ici par la page (`plugin_document_set`),
// il est rendu sous `tentacle://plugin/<id>` avec SA politique (`csp.h`). Hors du cadre
// principal, un greffon n'a pas `window.__shell` : il n'appelle aucune commande native.
//
// Huit documents au plus (le plus ancien part), 8 Mi caractères chacun. Sûr entre fils.

#include <optional>
#include <string>
#include <string_view>

namespace tentacle::net::plugins {

inline constexpr char kPluginHost[] = "plugin";
inline constexpr size_t kMaxDocuments = 8;
inline constexpr size_t kMaxHtmlChars = 8 * 1024 * 1024;  // unités UTF-16, comme zod `.max`

/// /^[a-zA-Z0-9._-]{1,64}$/
bool isValidPluginId(std::string_view id);
/// Longueur d'une chaîne UTF-8 en unités UTF-16 (`String.length`).
size_t utf16Length(std::string_view utf8);
/// Dépose le document et rend l'URL à donner à l'iframe ; nullopt si l'identifiant est refusé.
std::optional<std::string> setDocument(const std::string& scheme, const std::string& id, std::string html);
std::optional<std::string> getDocument(const std::string& id);
/// Tests : vide le dépôt.
void clearDocuments();

}  // namespace tentacle::net::plugins
