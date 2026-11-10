// Le préchargement du disque du serveur (voir media_warm.h et mediaWarm.ts).

#include "net/media_warm.h"

#include <cmath>
#include <memory>
#include <regex>

#include "net/web_url.h"

namespace tentacle::net::warm {
namespace {

constexpr int kMaxInFlight = 2;
constexpr int64_t kReplayAfterMs = 10 * 60'000;
constexpr int kTimeoutMs = 15'000;
constexpr int64_t kMaxSafeInteger = 9007199254740991;

/// L'identifiant du titre, seul nom qui entre au journal — l'URL porte un jeton.
std::string itemOf(const std::string& url) {
  static const std::regex re("/Videos/([0-9a-fA-F]{32})/");
  std::smatch m;
  return std::regex_search(url, m, re) ? m[1].str().substr(0, 8) : "?";
}

}  // namespace

std::optional<std::string> refuseWarm(const std::string& url, const std::vector<Range>& ranges) {
  const auto parsed = parseHttpUrl(url);
  if (!parsed) {
    // `new URL` réussit pour d'autres schémas : seul le motif change.
    return url.find("://") != std::string::npos && url.rfind("http", 0) != 0 ? "protocole refusé" : "URL illisible";
  }
  static const std::regex stream("/Videos/[0-9a-f]{32}/stream$", std::regex::icase);
  if (!std::regex_search(parsed->path, stream)) return "pas un flux de lecture";
  if (ranges.empty() || ranges.size() > 2) return "une ou deux plages";
  for (const auto& [start, end] : ranges) {
    if (std::abs(start) > kMaxSafeInteger || std::abs(end) > kMaxSafeInteger || start < 0 || end < start) return "plage invalide";
    if (end - start + 1 > kMaxRangeBytes) return "plage trop longue";
  }
  return std::nullopt;
}

bool MediaWarmer::warm(const std::string& url, const std::vector<Range>& ranges) {
  std::string key = url + "#";
  for (size_t i = 0; i < ranges.size(); ++i) key += (i ? "," : "") + std::to_string(ranges[i].first) + "-" + std::to_string(ranges[i].second);
  const int64_t now = now_();
  if (auto it = recent_.find(key); it != recent_.end() && now - it->second < kReplayAfterMs) return false;
  if (inFlight_ >= kMaxInFlight) return false;
  recent_[key] = now;
  for (auto it = recent_.begin(); it != recent_.end();) it = now - it->second >= kReplayAfterMs ? recent_.erase(it) : std::next(it);
  inFlight_ += 1;
  struct Job {
    std::vector<std::string> results;
    size_t pending = 0;
    int64_t started = 0;
  };
  auto job = std::make_shared<Job>();
  job->results.resize(ranges.size());
  job->pending = ranges.size();
  job->started = now;
  for (size_t i = 0; i < ranges.size(); ++i) {
    HttpRequest r;
    r.url = url;
    r.headers = {{"Range", "bytes=" + std::to_string(ranges[i].first) + "-" + std::to_string(ranges[i].second)}};
    r.timeoutMs = kTimeoutMs;
    r.useCache = false;
    auto state = std::make_shared<std::pair<int64_t, std::string>>(0, "abandonné");  // octets, issue
    auto cancel = std::make_shared<std::function<void()>>();
    StreamHandler h;
    h.onHead = [state, cancel](int status, HeaderList) {
      // Tout sauf un 206, c'est le fichier entier qui arriverait : on coupe.
      if (status != 206) {
        state->second = "refusé (" + std::to_string(status) + ")";
        if (*cancel) (*cancel)();
      }
    };
    h.onData = [state](std::string_view d) { state->first += int64_t(d.size()); };
    h.onEnd = [this, state, job, i, url](bool complete) {
      if (complete && state->second == "abandonné") state->second = std::to_string(std::llround(double(state->first) / 1024)) + " Kio";
      job->results[i] = state->second;
      if (--job->pending > 0) return;
      inFlight_ -= 1;
      std::string all;
      for (size_t k = 0; k < job->results.size(); ++k) all += (k ? " · " : "") + job->results[k];
      if (trace_) trace_("préchargement " + itemOf(url) + " : " + all + " en " + std::to_string(now_() - job->started) + " ms");
    };
    *cancel = open_(std::move(r), std::move(h));
  }
  return true;
}

void handleMediaWarm(MediaWarmer& warmer, const bridge::Json& args, bridge::Reply reply) {
  const auto invalid = [&](const char* why) { reply.fail("bad_args", std::string("arguments invalides pour media_warm: ") + why); };
  if (!args.is_object() || !args.contains("url") || !args["url"].is_string()) return invalid("url : chaine attendue");
  if (!args.contains("ranges") || !args["ranges"].is_array()) return invalid("ranges : tableau attendu");
  std::vector<Range> ranges;
  for (const auto& r : args["ranges"]) {
    const auto isInt = [](const bridge::Json& v) { return v.is_number() && v.get<double>() == std::floor(v.get<double>()); };
    if (!r.is_array() || r.size() != 2 || !isInt(r[0]) || !isInt(r[1])) return invalid("ranges : [entier, entier] attendu");
    ranges.emplace_back(int64_t(r[0].get<double>()), int64_t(r[1].get<double>()));
  }
  const std::string url = args["url"].get<std::string>();
  if (auto refusal = refuseWarm(url, ranges)) return reply.fail("refused", "media_warm : " + *refusal);
  reply.ok(warmer.warm(url, ranges) ? "en cours" : "écarté");
}

}  // namespace tentacle::net::warm
