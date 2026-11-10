#include "video_channels.h"

#include <cstdio>
#include <algorithm>
#include <cstdlib>
#include <set>
#include <vector>

#include "mpv_policy.h"

namespace bridge {
namespace {

// `time-pos` change à chaque image : à 120 Hz, autant de messages vers la page.
// 8 Hz suffisent (la page extrapole avec `at`) — la cadence d'Electron (`mpvDrain.ts`).
constexpr double kThrottleMs = 125.0;
const std::set<std::string> kThrottled = {"time-pos", "audio-pts"};

double nowMs() {
  using namespace std::chrono;
  return static_cast<double>(duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count());
}

// Bancs (`TENTACLE_PONT_TRACE=1`) : chaque écriture de la page vers mpv, horodatée, sur
// stderr. L'URL d'un `loadfile` / `sub-add` n'y figure jamais (elle porte le jeton).
void trace(const std::string& what, const Json& detail) {
  static const bool on = [] { const char* v = std::getenv("TENTACLE_PONT_TRACE"); return v && *v && *v != '0'; }();
  if (on) std::fprintf(stderr, "[pont-trace] %.0f %s %s\n", nowMs(), what.c_str(), detail.dump().c_str());
}

void failWith(Reply& reply, const std::string& code, const std::string& message) {
  std::fprintf(stderr, "[pont] %s\n", message.c_str());
  reply.fail(code, message);
}

}  // namespace

VideoChannels::VideoChannels(Registry& registry, PlayerPort& player, Clock clock, Defer defer)
    : registry_(registry), player_(player), clock_(clock ? std::move(clock) : Clock(nowMs)), defer_(std::move(defer)) {
  registry_.event("mpv://event");
  registry_.event("mpv://property-change");
  registry_.command("mpv_init", [this](const Json& p, Reply r) { init(p, std::move(r)); });
  registry_.command("mpv_destroy", [this](const Json&, Reply r) { destroy(std::move(r)); });
  registry_.command("mpv_command", [this](const Json& p, Reply r) { command(p, std::move(r)); });
  registry_.command("mpv_set_property", [this](const Json& p, Reply r) { setProperty(p, std::move(r)); });
  registry_.command("mpv_get_property", [this](const Json& p, Reply r) { getProperty(p, std::move(r)); });
  player_.setListener(this);
}

VideoChannels::~VideoChannels() {
  *alive_ = false;
  player_.setListener(nullptr);
}

void VideoChannels::init(const Json& payload, Reply reply) {
  const Json options = payload.value("options", Json::object());
  const auto filtered = mpv_policy::filterInitOptions(options.value("initialOptions", Json::object()));
  // Écartées en silence chez Electron, et c'est ce qui rendait un écran noir muet :
  // ici le journal nomme tout ce qui n'est pas passé.
  for (const auto& n : filtered.ownedByPlayer) std::fprintf(stderr, "[pont] option laissée au lecteur : %s\n", n.c_str());
  for (const auto& n : filtered.refused) std::fprintf(stderr, "[pont] option refusée : %s\n", n.c_str());

  std::vector<std::pair<std::string, std::string>> observed;
  for (const auto& entry : options.value("observedProperties", Json::array())) {
    if (entry.is_array() && entry.size() >= 2 && entry[0].is_string() && entry[1].is_string()) {
      observed.emplace_back(entry[0].get<std::string>(), entry[1].get<std::string>());
    }
  }
  if (onVideoClaim_) onVideoClaim_();
  trace("mpv_init", Json::array());

  auto launch = [this, kept = filtered.kept, observed, reply]() mutable {
    observedIds_.clear();
    lastEmitted_.clear();
    held_.clear();
    player_.start(kept, [this, observed, reply](std::optional<std::string> err) mutable {
      if (err) return failWith(reply, "mpv_init", "mpv_init : " + *err);
      int id = 1;
      for (const auto& [name, format] : observed) {
        observedIds_[name] = id++;
        player_.observe(name, format);
      }
      reply.ok("ok");
    });
  };
  // Une instance encore vivante (épisode suivant qui se chevauche) part d'abord.
  if (player_.running()) player_.stop(std::move(launch));
  else launch();
}

void VideoChannels::destroy(Reply reply) {
  trace("mpv_destroy", Json::array());
  flushHeld();
  player_.stop([this, alive = alive_, reply]() {
    reply.ok(nullptr);
    if (*alive && onPlaybackEnded_) onPlaybackEnded_();
  });
}

void VideoChannels::command(const Json& payload, Reply reply) {
  const std::string name = payload.value("name", "");
  std::vector<std::string> args;
  for (const auto& a : payload.value("args", Json::array())) args.push_back(mpv_policy::toMpvString(a));
  if (auto refusal = mpv_policy::refuseCommand(name, args)) return failWith(reply, "refused", *refusal);
  if (!player_.running()) return failWith(reply, "no_player", name + " : mpv non initialise");
  Json argv = Json::array({name});
  for (const auto& a : args) argv.push_back(a);
  Json shown = argv;
  if ((name == "loadfile" || name == "sub-add") && shown.size() > 1) shown[1] = "<url>";
  trace("mpv_command", shown);
  // Les ARGUMENTS ne vont jamais au journal : l'URL d'un loadfile porte le jeton.
  player_.command(argv, [name, reply](std::optional<std::string> err) mutable {
    if (err) return failWith(reply, "mpv_command", name + " : " + *err);
    reply.ok(nullptr);
  });
}

void VideoChannels::setProperty(const Json& payload, Reply reply) {
  const std::string name = payload.value("name", "");
  if (auto refusal = mpv_policy::refuseWrite(name)) return failWith(reply, "refused", *refusal);
  if (!player_.running()) return failWith(reply, "no_player", name + " : mpv non initialise");
  const Json value = payload.contains("value") ? payload["value"] : Json(nullptr);
  if (!value.is_primitive() || value.is_null()) return failWith(reply, "bad_value", name + " : valeur invalide");
  trace("mpv_set_property", {name, value});
  player_.setProperty(name, value, [name, reply](std::optional<std::string> err) mutable {
    if (err) return failWith(reply, "mpv_set_property", name + " : " + *err);
    reply.ok(nullptr);
  });
}

void VideoChannels::getProperty(const Json& payload, Reply reply) {
  const std::string name = payload.value("name", "");
  const std::string format = payload.value("format", "string");
  // Lecture seule et sans effet : pas de liste blanche (Electron n'en a pas non plus).
  if (name.empty() || !player_.running()) return reply.ok(nullptr);
  player_.getProperty(name, [format, reply](std::optional<Json> value) mutable {
    reply.ok(value ? mpv_policy::coerce(*value, format) : Json(nullptr));
  });
}

void VideoChannels::onProperty(const std::string& name, const Json& value) {
  if (propertyObserver_) propertyObserver_(name, value);
  const auto id = observedIds_.find(name);
  if (id == observedIds_.end()) return;  // observée pour un autre (vidéo-HDR, sonde EDR)
  const double at = clock_();
  // `pause`, `seeking` et la fin figent la position : la dernière retenue doit partir.
  if (!kThrottled.count(name)) flushHeld();
  Json change = {{"name", name}, {"data", value}, {"id", id->second}, {"at", at}};
  if (kThrottled.count(name)) {
    if (at - lastEmitted_[name] < kThrottleMs) {
      held_[name] = std::move(change);
      // Sans autre mouvement (pause : rien d'autre ne change), la retenue partirait trop tard.
      scheduleFlush(kThrottleMs - (at - lastEmitted_[name]));
      return;
    }
    held_.erase(name);
    lastEmitted_[name] = at;
  }
  registry_.emit("mpv://property-change", change);
}

void VideoChannels::onEvent(const Json& event) {
  if (!event.is_object() || !event.contains("event")) return;
  if (event["event"] == "playback-restart") flushHeld();  // seek abouti : la position d'abord
  registry_.emit("mpv://event", event);
}

void VideoChannels::scheduleFlush(double delayMs) {
  if (!defer_ || flushScheduled_) return;
  flushScheduled_ = true;
  std::weak_ptr<bool> alive = alive_;
  defer_(static_cast<int>(delayMs) + 1, [this, alive] {
    if (alive.expired()) return;
    flushScheduled_ = false;
    flushDue();
  });
}

// Les valeurs retenues dont la fenêtre de 125 ms est passée partent ; les autres attendent.
void VideoChannels::flushDue() {
  const double at = clock_();
  double wait = -1;
  for (auto it = held_.begin(); it != held_.end();) {
    const double since = at - lastEmitted_[it->first];
    if (since < kThrottleMs) {
      wait = wait < 0 ? kThrottleMs - since : std::min(wait, kThrottleMs - since);
      ++it;
      continue;
    }
    lastEmitted_[it->first] = it->second["at"].get<double>();
    registry_.emit("mpv://property-change", it->second);
    it = held_.erase(it);
  }
  if (wait >= 0) scheduleFlush(wait);
}

void VideoChannels::flushHeld() {
  for (auto& [name, change] : held_) {
    lastEmitted_[name] = change["at"].get<double>();
    registry_.emit("mpv://property-change", change);
  }
  held_.clear();
}

}  // namespace bridge
