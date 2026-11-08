// Ce que la page a le droit de demander à mpv.
//
// Reprise de la liste blanche de la coquille Electron (`main/video/mpvAllowlist.ts`) :
// libmpv expose `run`, `subprocess`, `load-script` — sans garde, la page lancerait un
// programme. Une différence voulue : les options de FENÊTRE et de SORTIE (`vo`,
// `gpu-api`, `gpu-context`, `force-window`, `border`…) appartiennent au lecteur de
// vidéo-HDR, qui fait dessiner mpv dans NOTRE couche Metal (PQ, EDR). La page les
// envoie (`buildMpvInitOptions`, pensé pour la fenêtre de mpv d'Electron) : on les
// écarte, sans quoi elle pourrait casser le HDR.
#pragma once

#include <optional>
#include <string>
#include <vector>

#include "ports.h"

namespace bridge::mpv_policy {

struct FilteredOptions {
  Json kept = Json::object();
  std::vector<std::string> ownedByPlayer;  // écartées : sortie/fenêtre (vidéo-HDR)
  std::vector<std::string> refused;        // écartées : inconnues
};

/// Trie les options d'init de la page. Les valeurs deviennent des chaînes mpv
/// (booléens en `yes`/`no`), comme `mpv_set_option_string`.
FilteredOptions filterInitOptions(const Json& options);

/// `nullopt` si la commande est permise, sinon le motif du refus.
std::optional<std::string> refuseCommand(const std::string& name, const std::vector<std::string>& args);

/// `nullopt` si la propriété est inscriptible par la page.
std::optional<std::string> refuseWrite(const std::string& name);

/// Valeur d'une propriété lue, retypée selon le format demandé par la page
/// (`flag` → bool, `int64`/`double` → nombre, `string` → chaîne) ; `null` sinon.
Json coerce(const Json& value, const std::string& format);

/// Scalaire de la page → chaîne mpv (`true` → `yes`).
std::string toMpvString(const Json& value);

}  // namespace bridge::mpv_policy
