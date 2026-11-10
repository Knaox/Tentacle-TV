#include "lifecycle/playback_farewell.h"

#include <algorithm>
#include <cmath>
#include <memory>

#include <nlohmann/json.hpp>

namespace tentacle::lifecycle {
namespace {

constexpr double kTicksPerMs = 10'000;

struct Report {
  std::string itemId;
  std::optional<std::string> mediaSourceId, playSessionId;
  std::optional<double> positionTicks;
  std::optional<bool> isPaused;
};

std::optional<std::string> text(const nlohmann::json& fields, const char* key) {
  const auto it = fields.find(key);
  if (it == fields.end() || !it->is_string()) return std::nullopt;
  auto value = it->get<std::string>();
  if (value.empty()) return std::nullopt;
  return value;
}

std::optional<Report> parseReport(const std::string& body) {
  const auto raw = nlohmann::json::parse(body, nullptr, false);
  if (raw.is_discarded() || !raw.is_object()) return std::nullopt;
  auto itemId = text(raw, "ItemId");
  if (!itemId) return std::nullopt;
  Report r{*itemId, text(raw, "MediaSourceId"), text(raw, "PlaySessionId"), {}, {}};
  if (auto it = raw.find("PositionTicks"); it != raw.end() && it->is_number()) {
    const double ticks = it->get<double>();
    if (std::isfinite(ticks) && ticks >= 0) r.positionTicks = ticks;
  }
  if (auto it = raw.find("IsPaused"); it != raw.end() && it->is_boolean()) r.isPaused = it->get<bool>();
  return r;
}

/// Une lecture est identifiée par sa session de lecture, à défaut par son média.
std::string keyOf(const Report& r) { return r.playSessionId.value_or(r.itemId); }

}  // namespace

// Une sortie en cours : ce qu'elle attend encore, et son rappel unique.
struct PlaybackFarewell::Wait {
  std::set<uint64_t> tracked;  // envois en vol au moment de la sortie
  int sends = 0;               // arrêts postés pas encore finis
  std::function<void()> finished;
  void settle() {
    if (!finished || sends > 0 || !tracked.empty()) return;
    auto fn = std::move(finished);
    finished = nullptr;
    fn();
  }
  void expire() {
    if (!finished) return;
    auto fn = std::move(finished);
    finished = nullptr;
    fn();
  }
};

void PlaybackFarewell::note(const SessionPost& post) {
  const auto report = parseReport(post.body);
  if (!report) return;
  const std::string key = keyOf(*report);
  if (post.path == "/Sessions/Playing/Stopped") {
    open_.erase(key);
    // Un arrêt sans session de lecture ferme tout ce qui porte ce média.
    std::erase_if(open_, [&](const auto& entry) { return entry.second.itemId == report->itemId; });
    return;
  }
  // Début ou progression. Une progression d'une lecture inconnue l'ouvre : pour Jellyfin, elle
  // est en cours (il la ranime sur un simple report).
  const auto previous = open_.find(key);
  const Open* before = previous == open_.end() ? nullptr : &previous->second;
  Open next;
  next.baseUrl = post.baseUrl;
  next.token = post.token;
  next.authHeader = post.authHeader;
  next.itemId = report->itemId;
  next.mediaSourceId = report->mediaSourceId ? report->mediaSourceId : (before ? before->mediaSourceId : std::nullopt);
  next.playSessionId = report->playSessionId;
  next.positionTicks = report->positionTicks.value_or(before ? before->positionTicks : 0);
  next.isPaused = report->isPaused.value_or(before ? before->isPaused : false);
  next.reportedAt = now_();
  open_[key] = std::move(next);
}

uint64_t PlaybackFarewell::track() {
  const uint64_t token = nextToken_++;
  inFlight_.insert(token);
  return token;
}

void PlaybackFarewell::release(uint64_t token) {
  inFlight_.erase(token);
  for (auto& wait : waits_) {
    if (wait->tracked.erase(token) > 0) wait->settle();
  }
  std::erase_if(waits_, [](const auto& w) { return !w->finished; });
}

std::vector<FarewellStop> PlaybackFarewell::stops() const {
  const int64_t at = now_();
  std::vector<FarewellStop> out;
  for (const auto& [_, p] : open_) {
    const int64_t elapsed =
        p.isPaused ? 0 : std::min(std::max<int64_t>(at - p.reportedAt, 0), kMaxExtrapolationMs);
    // Ordre des clés de JSON.stringify : ItemId, MediaSourceId, PositionTicks, PlaySessionId.
    nlohmann::ordered_json body;
    body["ItemId"] = p.itemId;
    body["MediaSourceId"] = p.mediaSourceId.value_or(p.itemId);
    body["PositionTicks"] = static_cast<int64_t>(std::floor(p.positionTicks + double(elapsed) * kTicksPerMs));
    if (p.playSessionId) body["PlaySessionId"] = *p.playSessionId;
    out.push_back({p.baseUrl, p.token, p.authHeader, body.dump()});
  }
  return out;
}

void PlaybackFarewell::farewell(const Send& send, int64_t deadlineMs, const After& after,
                                std::function<void()> finished) {
  auto wait = std::make_shared<Wait>();
  wait->tracked = inFlight_;
  wait->finished = std::move(finished);
  const auto toPost = stops();
  open_.clear();
  waits_.push_back(wait);
  wait->sends = int(toPost.size());
  for (const auto& stop : toPost) {
    // `done` peut arriver tout de suite, plus tard ou jamais ; une exception vaut un échec.
    auto once = std::make_shared<bool>(false);
    auto done = [wait, once] {
      if (*once) return;
      *once = true;
      --wait->sends;
      wait->settle();
    };
    try {
      if (send) send(stop, done);
      else done();
    } catch (...) {
      done();
    }
  }
  if (after) after(deadlineMs, [wait] { wait->expire(); });
  wait->settle();
  std::erase_if(waits_, [](const auto& w) { return !w->finished; });
}

}  // namespace tentacle::lifecycle
