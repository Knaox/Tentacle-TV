#pragma once
// Le client HTTP du processus principal : CefURLRequest, la pile réseau de Chromium déjà
// chargée (proxy, certificats et cache du profil), jamais une seconde pile embarquée — comme
// `net.fetch` d'Electron. Sans cookie par défaut (`credentials: "omit"`), sans en-tête
// `Origin` : c'est ce qui permet aux relais de contourner le CORS de `tentacle://app`.

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace tentacle::net {

using HeaderList = std::vector<std::pair<std::string, std::string>>;

struct HttpRequest {
  std::string url;
  std::string method = "GET";
  HeaderList headers;
  std::optional<std::string> body;
  int64_t maxBytes = -1;        // au-delà : abandon, `tooLarge`
  int timeoutMs = 0;            // 0 : sans délai ; au-delà : abandon, `timedOut`
  bool cookies = false;         // cookies et identifiants gardés du profil
  bool followRedirects = true;  // faux : la réponse 3xx est rendue telle quelle
  bool useCache = true;         // faux : ni lu ni écrit dans le cache HTTP
};

struct HttpResponse {
  bool received = false;  // une réponse HTTP est arrivée (même 4xx/5xx)
  int status = 0;
  std::string statusText;
  HeaderList headers;      // noms tels que reçus
  std::string body;
  std::string finalUrl;    // après redirections
  bool tooLarge = false;
  bool timedOut = false;
  bool canceled = false;
  int error = 0;           // code d'erreur réseau de Chromium (ERR_*), 0 sinon
  bool ok() const { return received && status >= 200 && status < 300 && !tooLarge; }
  std::optional<std::string> header(std::string_view name) const;  // insensible à la casse
};

using HttpDone = std::function<void(HttpResponse)>;

/// Depuis n'importe quel fil du processus principal. `done` arrive sur le fil UI de CEF (le
/// fil principal), une seule fois. Rend une fonction d'annulation (sûre depuis tout fil).
std::function<void()> httpFetch(HttpRequest request, HttpDone done);

}  // namespace tentacle::net

namespace tentacle::net {

/// Une réponse lue AU FIL de son arrivée (relais des flux directs) : `onHead` une fois, avant
/// toute donnée (ou à la fin pour un corps vide) ; `onData` par morceau ; `onEnd` une fois —
/// `complete` faux si la réponse n'est pas arrivée entière (coupure, refus, délai). Sans octet
/// pendant `idleTimeoutMs` (0 : jamais) : abandon. Le corps n'est jamais gardé en entier.
struct StreamHandler {
  std::function<void(int status, HeaderList headers)> onHead;
  std::function<void(std::string_view chunk)> onData;
  std::function<void(bool complete)> onEnd;
};

/// Rappels sur le fil UI de CEF ; rend l'annulation (sûre depuis tout fil ; `onEnd(false)` suit).
std::function<void()> httpStream(HttpRequest request, int idleTimeoutMs, StreamHandler handler);

}  // namespace tentacle::net
