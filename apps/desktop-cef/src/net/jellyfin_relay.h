#pragma once
// Les relais Jellyfin du processus principal — portage de
// `apps/desktop-electron/src/main/ipc/jellyfin.ts`. La page vit sous `tentacle://app`, qu'aucun
// Jellyfin n'autorise en CORS : le principal poste à sa place, sans `Origin`.
//
// Aucun n'est un `fetch` déguisé offert à la page : la télémétrie est bornée à une liste
// FERMÉE de chemins ; `PlaybackInfo` et `ActiveEncodings` sont construits ICI à partir de
// morceaux validés (jamais un chemin libre de la page), adresse http(s) sans identifiants.
//
//   jellyfin_session_post  {baseUrl, path, token, authHeader, body} → {status}
//   jellyfin_playback_info {baseUrl, itemId, query, token, authHeader, body} → {status, body}
//   jellyfin_kill_encodings {baseUrl, deviceId, playSessionId, token, authHeader} → {status}
// 20 s au plus chacun ; un échec réseau rejette (comme `net.fetch`).

#include <functional>
#include <string>

#include "net/cef_fetch.h"
#include "ports.h"  // bridge::Json, bridge::Reply

namespace tentacle::net::jellyfin {

inline constexpr int kTimeoutMs = 20'000;

/// Vers le PROXY Tentacle (`…/api/jellyfin`) : `X-Emby-Token` + `X-Emby-Authorization` ; vers
/// Jellyfin EN DIRECT : `Authorization` seul (jeton ajouté s'il manque) — Jellyfin 12.
HeaderList requestHeaders(const std::string& baseUrl, const std::string& token,
                          const std::string& authHeader);

/// Un report de lecture relayé (pour l'adieu à Jellyfin à la sortie, axe systeme).
struct SessionPost {
  std::string baseUrl, path, token, authHeader, body;
};

using Fetch = std::function<void(HttpRequest, HttpDone)>;

class Relay {
 public:
  explicit Relay(Fetch fetch) : fetch_(std::move(fetch)) {}

  void sessionPost(const bridge::Json& args, bridge::Reply reply);
  void playbackInfo(const bridge::Json& args, bridge::Reply reply);
  void killEncodings(const bridge::Json& args, bridge::Reply reply);

  /// L'adieu à Jellyfin (`playbackFarewell.note` / `.track` d'Electron) : `note` reçoit chaque
  /// report AVANT son envoi ; `track` est appelée au départ de l'envoi et rend la fonction à
  /// appeler UNE fois à sa fin (succès ou échec).
  using Track = std::function<std::function<void()>()>;
  void setSessionHooks(std::function<void(const SessionPost&)> note, Track track);

  /// L'arrêt posté à la sortie pour une lecture restée ouverte (`postFarewellStop`).
  void postStop(const std::string& baseUrl, const std::string& token, const std::string& authHeader,
                const std::string& body, std::function<void(int status)> done);

 private:
  void post(const std::string& url, const std::string& method, HeaderList headers,
            std::optional<std::string> body, std::function<void(HttpResponse)> done);
  Fetch fetch_;
  std::function<void(const SessionPost&)> note_;
  Track track_;
};

}  // namespace tentacle::net::jellyfin
