// Les relais Jellyfin (voir jellyfin_relay.h et ipc/jellyfin.ts).

#include "net/jellyfin_relay.h"

#include <regex>
#include <set>

#include "net/arg_check.h"
#include "net/web_url.h"

namespace tentacle::net::jellyfin {
namespace {

/// Points de terminaison admis, liste FERMÉE — c'est elle, et elle seule, qui empêche la
/// commande de devenir un relais HTTP généraliste.
const std::set<std::string>& sessionPaths() {
  static const std::set<std::string> p = {"/Sessions/Playing", "/Sessions/Playing/Progress",
                                          "/Sessions/Playing/Stopped"};
  return p;
}

bool matches(const std::string& s, const char* pattern) {
  return std::regex_match(s, std::regex(pattern));
}

}  // namespace

HeaderList requestHeaders(const std::string& baseUrl, const std::string& token, const std::string& authHeader) {
  const auto url = parseHttpUrl(baseUrl);
  const std::string path = url ? toLowerAscii(url->path) : "";
  if (path.ends_with("/api/jellyfin") || path.ends_with("/api/jellyfin/")) {  // /\/api\/jellyfin\/?$/i
    return {{"X-Emby-Token", token}, {"X-Emby-Authorization", authHeader}};
  }
  const bool hasToken = authHeader.find("Token=\"") != std::string::npos;
  return {{"Authorization", hasToken ? authHeader : authHeader + ", Token=\"" + token + "\""}};
}

void Relay::setSessionHooks(std::function<void(const SessionPost&)> note, Track track) {
  note_ = std::move(note);
  track_ = std::move(track);
}

void Relay::post(const std::string& url, const std::string& method, HeaderList headers,
                 std::optional<std::string> body, std::function<void(HttpResponse)> done) {
  HttpRequest r;
  r.url = url;
  r.method = method;
  r.headers = std::move(headers);
  r.body = std::move(body);
  r.timeoutMs = kTimeoutMs;
  r.useCache = false;
  fetch_(std::move(r), std::move(done));
}

static HeaderList withJson(HeaderList h) {
  h.insert(h.begin(), {"Content-Type", "application/json"});
  return h;
}

void Relay::sessionPost(const bridge::Json& args, bridge::Reply reply) {
  ArgCheck a("jellyfin_session_post", args);
  const auto baseUrl = a.httpUrl("baseUrl");
  const auto path = a.str("path");
  const auto token = a.str("token", 1);
  const auto authHeader = a.str("authHeader", 1);
  const auto body = a.str("body");
  if (!a.ok()) return reply.fail("bad_args", a.error());
  if (!sessionPaths().count(*path)) return reply.fail("refused", "chemin de session refuse: " + *path);
  SessionPost post{*baseUrl, *path, *token, *authHeader, *body};
  // Noté AVANT l'envoi, et l'envoi suivi : une fermeture qui arrive pendant qu'il vole
  // l'attendra (`playbackFarewell.ts`).
  if (note_) note_(post);
  std::function<void()> finished = track_ ? track_() : nullptr;
  this->post(*baseUrl + *path, "POST", withJson(requestHeaders(*baseUrl, *token, *authHeader)), *body,
             [reply, finished](HttpResponse r) {
               if (finished) finished();
               if (!r.received) return reply.fail("network", networkError(r));
               reply.ok(bridge::Json{{"status", r.status}});
             });
}

void Relay::playbackInfo(const bridge::Json& args, bridge::Reply reply) {
  ArgCheck a("jellyfin_playback_info", args);
  const auto baseUrl = a.httpUrl("baseUrl");
  const auto itemId = a.str("itemId");
  const auto query = a.str("query");
  const auto token = a.str("token", 1);
  const auto authHeader = a.str("authHeader", 1);
  const auto body = a.str("body");
  // Un identifiant Jellyfin, jamais un chemin ; une query encodée seulement (ni / ni ? ni #).
  if (itemId && !matches(*itemId, "^[A-Za-z0-9-]+$")) a.invalid("itemId");
  if (query && !matches(*query, "^[A-Za-z0-9&=._%~-]*$")) a.invalid("query");
  if (!a.ok()) return reply.fail("bad_args", a.error());
  const std::string path = "/Items/" + *itemId + "/PlaybackInfo" + (query->empty() ? "" : "?" + *query);
  post(*baseUrl + path, "POST", withJson(requestHeaders(*baseUrl, *token, *authHeader)), *body,
       [reply](HttpResponse r) {
         if (!r.received) return reply.fail("network", networkError(r));
         reply.ok(bridge::Json{{"status", r.status}, {"body", sanitizeUtf8(r.body)}});
       });
}

void Relay::killEncodings(const bridge::Json& args, bridge::Reply reply) {
  ArgCheck a("jellyfin_kill_encodings", args);
  const auto baseUrl = a.httpUrl("baseUrl");
  const auto deviceId = a.str("deviceId", 1);
  const auto playSessionId = a.str("playSessionId", 1);
  const auto token = a.str("token", 1);
  const auto authHeader = a.str("authHeader", 1);
  if (!a.ok()) return reply.fail("bad_args", a.error());
  const std::string path = "/Videos/ActiveEncodings?deviceId=" + encodeUriComponent(*deviceId) +
                           "&playSessionId=" + encodeUriComponent(*playSessionId);
  post(*baseUrl + path, "DELETE", requestHeaders(*baseUrl, *token, *authHeader), std::nullopt,
       [reply](HttpResponse r) {
         if (!r.received) return reply.fail("network", networkError(r));
         reply.ok(bridge::Json{{"status", r.status}});
       });
}

void Relay::postStop(const std::string& baseUrl, const std::string& token, const std::string& authHeader,
                     const std::string& body, std::function<void(int)> done) {
  post(baseUrl + "/Sessions/Playing/Stopped", "POST", withJson(requestHeaders(baseUrl, token, authHeader)),
       body, [done](HttpResponse r) {
         if (done) done(r.received ? r.status : 0);
       });
}

}  // namespace tentacle::net::jellyfin
