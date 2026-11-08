#include "music/octave_shell.h"

#include <chrono>
#include <cstdlib>
#include <deque>
#include <memory>

#include "music/mpv_audio_backend.h"
#include "music/player_audio_backend.h"
#include "music/octave_channels.h"
#include "music/audio_engine.h"
#include "registry.h"
#include "shell/ipc.h"
#include "shell/main_thread.h"

namespace tentacle::music {
namespace {

class MainScheduler final : public Scheduler {
 public:
  void post(std::function<void()> task) override { postToMain(std::move(task)); }
  void postDelayed(int delayMs, std::function<void()> task) override {
    postToMainDelayed(std::move(task), delayMs);
  }
};

MainScheduler& scheduler() {
  static MainScheduler s;
  return s;
}

std::unique_ptr<OctaveChannels>& channels() {
  static std::unique_ptr<OctaveChannels> c;
  return c;
}

void installDebugChannels();

// Le relevé du banc : ce que le front a demandé, ce que le moteur a dit (borné).
struct Trace {
  std::deque<Json> calls, events;
  int64_t callBase = 0, eventBase = 0;  // index absolu du premier élément gardé
};
Trace& trace() {
  static Trace t;
  return t;
}
int64_t nowMs() {
  return std::chrono::duration_cast<std::chrono::milliseconds>(
             std::chrono::system_clock::now().time_since_epoch()).count();
}
void keep(std::deque<Json>& q, int64_t& base, Json item) {
  q.push_back(std::move(item));
  if (q.size() > 2000) {
    q.pop_front();
    base++;
  }
}

}  // namespace

void installInShell(bridge::Registry& registry) {
  if (channels()) return;
  // Le son : le `Player` l'impose (sortie native, ou `ao=null` + `mute=yes` sous `--mute`,
  // `player/sound_policy.h`). Le moteur de Homebrew (banc seul) reste sans sortie.
  Options extra;
#ifndef TENTACLE_MUSIC_HAS_PLAYER
  extra.emplace_back("ao", "null");
#endif
  channels() = std::make_unique<OctaveChannels>(scheduler(), [] {
#ifdef TENTACLE_MUSIC_HAS_PLAYER
    // Le `Player` de vidéo-HDR en audio seul : aucune surface, jamais.
    return std::unique_ptr<AudioBackend>(std::make_unique<PlayerAudioBackend>(scheduler()));
#else
    return std::unique_ptr<AudioBackend>(std::make_unique<MpvAudioBackend>(scheduler()));
#endif
  }, extra);
  registry.event(OctaveChannels::kEvent);
  channels()->install(
      [&registry](const std::string& channel, OctaveChannels::Handler handler) {
        registry.command(channel, [handler, channel](const bridge::Json& payload, bridge::Reply r) {
          Json args = payload;
          // Le jeton ne se relève pas : on garde les NOMS d'en-têtes, jamais leurs valeurs.
          if (args.contains("headers") && args["headers"].is_object())
            for (auto& [k, v] : args["headers"].items()) v = "…";
          keep(trace().calls, trace().callBase, {{"t", nowMs()}, {"channel", channel}, {"args", std::move(args)}});
          handler(payload, r.ok, r.fail);
        });
      },
      [&registry](const std::string& event, nlohmann::json payload) {
        Json item = payload;
        item["t"] = nowMs();
        keep(trace().events, trace().eventBase, std::move(item));
        registry.emit(event, payload);
      });
  installDebugChannels();
}

namespace {

// Diagnostic du banc, HORS de `window.tentacle` (par `__shell.invoke`, comme
// `pont.debug.surface`) : lire une propriété du mpv de la musique, simuler
// « une vidéo démarre ». Jamais appelés par le front.
void installDebugChannels() {
  ipc::registerHandler("octave.debug.prop", [](const Json& payload, ipc::Responder r) {
    AudioEngine* engine = channels() ? channels()->engine() : nullptr;
    if (!engine) return r.reply(nullptr);
    engine->readProperty(payload.value("name", ""), [r](Json v) { r.reply(std::move(v)); });
  });
  // `{calls, events}` depuis les index absolus `fromCall` / `fromEvent`.
  ipc::registerHandler("octave.debug.log", [](const Json& p, ipc::Responder r) {
    auto slice = [](const std::deque<Json>& q, int64_t base, int64_t from) {
      Json out = Json::array();
      for (int64_t i = std::max<int64_t>(0, from - base); i < static_cast<int64_t>(q.size()); i++) out.push_back(q[i]);
      return out;
    };
    Trace& t = trace();
    r.reply({{"calls", slice(t.calls, t.callBase, p.value("fromCall", int64_t{0}))},
             {"events", slice(t.events, t.eventBase, p.value("fromEvent", int64_t{0}))},
             {"callCount", t.callBase + static_cast<int64_t>(t.calls.size())},
             {"eventCount", t.eventBase + static_cast<int64_t>(t.events.size())}});
  });
  ipc::registerHandler("octave.debug.claim", [](const Json&, ipc::Responder r) { r.reply(videoClaim()); });
}

}  // namespace

bool videoClaim() { return channels() && channels()->onVideoClaim(); }

void shutdownMusic() {
  if (channels())
    channels()->dispatch("audio_engine_stop", nlohmann::json::object(), [](nlohmann::json) {},
                         [](std::string, std::string) {});
}

}  // namespace tentacle::music
