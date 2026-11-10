#pragma once
// Une source de lecture qui porte un flux DIRECT (`direct`, requêtes déléguées) — portage de
// `clientFetch/directSources.ts` : adoptée seulement si l'hôte du flux est dans les `mediaHosts`
// que l'extension du titre DÉCLARE (lus par l'app, `PluginManifests`), en https, et pas sur le
// point d'expirer (30 s) ; mpv reçoit alors l'adresse du relais local, dont le repli est l'`url`
// du serveur. Sinon le flux direct est ignoré : la source du serveur joue, comme avant.

#include <functional>
#include <optional>
#include <string>

#include "net/client_fetch_run.h"
#include "net/direct_relay.h"

namespace tentacle::net::direct {

/// `ext:<extension>:<identifiant>` → l'extension ; nullopt pour la bibliothèque.
std::optional<std::string> pluginOfTrack(const std::string& trackKey);

/// `source` : `{url, origin: "library"|"plugin", direct?: {url, expiresAt: ms|null}, …}`. `done`
/// reçoit la source SANS `direct`, `url` remplacée par l'adresse locale quand le direct est adopté.
/// Fil des manifestes (le principal).
void adoptDirect(cf::Json source, const std::string& trackKey, const std::optional<cf::ServerSession>& session,
                 cf::PluginManifests& manifests, Relay& relay, std::function<int64_t()> now,
                 std::function<void(cf::Json source, bool adopted)> done);

}  // namespace tentacle::net::direct
