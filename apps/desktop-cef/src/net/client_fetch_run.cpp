// Les requêtes déléguées : plafond, exécution, manifestes (voir client_fetch_run.h).

#include "net/client_fetch_run.h"

#include <algorithm>
#include <memory>

#include "net/fs_platform.h"

namespace tentacle::net::cf {
namespace {

constexpr int64_t kMinute = 60'000, kHour = 3'600'000;
constexpr int64_t kManifestTtlMs = 5 * 60'000;
constexpr int kManifestTimeoutMs = 5'000;
constexpr size_t kMaxSessions = 4;

int64_t clock(const std::function<int64_t()>& now) { return now ? now() : nowMs(); }

struct RunState {
  Manifest manifest;
  Hop hop;
  HeaderList headers;
  std::string method;
  std::optional<std::string> body;
  int64_t deadline = 0, maxBytes = 0;
  int hops = 0;
  std::function<void(Outcome)> done;
};

void step(std::shared_ptr<RunState> s, WebUrl url) {
  HopRequest r{url, s->method, s->headers, s->body, s->deadline, s->maxBytes};
  s->hop(std::move(r), [s, url](HopResult result) {
    if (result.kind == HopResult::kFailed) return s->done(Outcome::refused(result.reason));
    if (result.kind == HopResult::kResponse) {
      return s->done(Outcome{true, result.status, url.href(), result.contentType, std::move(result.body), {}});
    }
    auto next = resolveUrl(url, result.location);
    if (next) next = allowedUrl(next->href(), s->manifest.hosts);
    if (!next) return s->done(Outcome::refused("refused"));
    if (result.status == 303 || ((result.status == 301 || result.status == 302) && s->method == "POST")) {
      s->method = "GET";
      s->body.reset();
    }
    if (++s->hops > limits::maxRedirects) return s->done(Outcome::refused("refused"));
    step(s, *next);
  });
}

}  // namespace

std::function<void()> Quota::take(const std::string& pluginId) {
  const int64_t t = clock(now_);
  auto& recent = starts_[pluginId];
  recent.erase(std::remove_if(recent.begin(), recent.end(), [&](int64_t at) { return t - at >= kHour; }), recent.end());
  int& busy = (*running_)[pluginId];
  if (busy >= limits::maxParallel) return nullptr;
  if (int(recent.size()) >= limits::perHour) return nullptr;
  if (std::count_if(recent.begin(), recent.end(), [&](int64_t at) { return t - at < kMinute; }) >= limits::perMinute) {
    return nullptr;
  }
  recent.push_back(t);
  busy += 1;
  auto released = std::make_shared<bool>(false);
  std::weak_ptr<std::map<std::string, int>> running = running_;
  return [released, running, pluginId] {
    if (*released) return;
    *released = true;
    if (auto r = running.lock()) (*r)[pluginId] = std::max(0, (*r)[pluginId] - 1);
  };
}

Json Outcome::toJson() const {
  if (!ok) return Json{{"ok", false}, {"reason", reason}};
  Json headers = Json::object();
  if (contentType) headers["content-type"] = *contentType;
  return Json{{"ok", true}, {"response", {{"status", status}, {"url", url}, {"headers", headers}, {"body", body}}}};
}

void runClientFetch(const Json& request, const Manifest& manifest, Hop hop, std::function<int64_t()> now,
                    std::function<void(Outcome)> done) {
  if (checkRequest(request, manifest)) return done(Outcome::refused("refused"));
  auto s = std::make_shared<RunState>();
  s->manifest = manifest;
  s->hop = std::move(hop);
  s->method = request["method"].get<std::string>();
  if (auto it = request.find("headers"); it != request.end()) {
    for (auto h = it->begin(); h != it->end(); ++h) s->headers.emplace_back(h.key(), h->get<std::string>());
  }
  if (auto it = request.find("body"); it != request.end()) s->body = it->get<std::string>();
  s->deadline = clock(now) + (request.contains("timeoutMs") ? request["timeoutMs"].get<int64_t>() : limits::defaultTimeoutMs);
  s->maxBytes = request.contains("maxBytes") ? request["maxBytes"].get<int64_t>() : limits::defaultMaxBytes;
  s->done = std::move(done);
  step(s, *parseHttpUrl(request["url"].get<std::string>()));
}

int64_t PluginManifests::now() const { return clock(now_); }

void PluginManifests::of(const ServerSession& session, const std::string& pluginId,
                         std::function<void(std::optional<Manifest>)> done) {
  std::string key = session.serverOrigin + "\n";
  for (const auto& [k, v] : session.headers) key += k + ":" + v + "\n";
  const auto pick = [pluginId, done](const Map& m) {
    auto it = m.find(pluginId);
    done(it == m.end() ? std::nullopt : std::optional<Manifest>(it->second));
  };
  for (const auto& [k, c] : cache_) {
    if (k == key && now() - c.at < kManifestTtlMs) return pick(c.manifests);
  }
  auto [it, first] = loading_.try_emplace(key);
  it->second.push_back(pick);
  if (!first) return;
  const auto base = parseHttpUrl(session.serverOrigin);
  const auto finish = [this, key](Map manifests, bool keep) {
    if (keep) {
      cache_.erase(std::remove_if(cache_.begin(), cache_.end(), [&](const auto& e) { return e.first == key; }), cache_.end());
      cache_.push_back({key, Cached{now(), manifests}});
      while (cache_.size() > kMaxSessions) cache_.erase(cache_.begin());
    }
    auto waiting = std::move(loading_[key]);
    loading_.erase(key);
    for (auto& w : waiting) w(manifests);
  };
  if (!base) return finish({}, false);
  HttpRequest r;
  r.url = base->origin() + "/api/plugins/active";
  r.headers = session.headers;
  r.timeoutMs = kManifestTimeoutMs;
  r.useCache = false;
  fetch_(std::move(r), [finish](HttpResponse resp) {
    if (!resp.ok()) return finish({}, false);
    const Json list = Json::parse(resp.body, nullptr, false);
    if (list.is_discarded()) return finish({}, false);
    Map out;
    for (const Json& e : list.is_array() ? list : Json::array()) {
      if (!e.is_object() || !e.contains("pluginId") || !e["pluginId"].is_string()) continue;
      if (auto m = readManifest(e.value("clientFetch", Json()))) out[e["pluginId"].get<std::string>()] = *m;
    }
    finish(std::move(out), true);
  });
}

void PluginManifests::mediaHosts(const ServerSession& session, const std::string& pluginId,
                                 std::function<void(std::vector<std::string>)> done) {
  of(session, pluginId, [done](std::optional<Manifest> m) { done(m ? m->mediaHosts : std::vector<std::string>{}); });
}

void runDelegated(const ServerSession& session, const std::string& pluginId, const Json& request,
                  PluginManifests& manifests, Quota& quota, Hop hop, std::function<int64_t()> now,
                  std::function<void(Outcome)> done) {
  manifests.of(session, pluginId, [=, &quota](std::optional<Manifest> manifest) {
    if (!manifest) return done(Outcome::refused("refused"));
    auto release = quota.take(pluginId);
    if (!release) return done(Outcome::refused("budget"));
    runClientFetch(request, *manifest, hop, now, [release, done](Outcome o) {
      release();
      done(std::move(o));
    });
  });
}

}  // namespace tentacle::net::cf
