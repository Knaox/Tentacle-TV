#include "music/player_audio_backend.h"

#include <cstdlib>

#include "player/player.h"

namespace tentacle::music {
namespace {

using json = nlohmann::json;

tentacle::PropFormat formatOf(PropFormat f) {
  switch (f) {
    case PropFormat::Flag: return tentacle::PropFormat::Flag;
    case PropFormat::Int64: return tentacle::PropFormat::Int64;
    case PropFormat::Double: return tentacle::PropFormat::Double;
    case PropFormat::String: return tentacle::PropFormat::String;
  }
  return tentacle::PropFormat::Node;
}

PropValue valueOf(const json& v) {
  if (v.is_boolean()) return v.get<bool>();
  if (v.is_number_integer()) return v.get<int64_t>();
  if (v.is_number()) return v.get<double>();
  if (v.is_string()) return v.get<std::string>();
  return std::monostate{};
}

}  // namespace

PlayerAudioBackend::PlayerAudioBackend(Scheduler& scheduler) : scheduler_(scheduler) {}

PlayerAudioBackend::~PlayerAudioBackend() = default;  // `~Player` arrête l'instance s'il le faut

std::optional<std::string> PlayerAudioBackend::start(const Options& options, const Observed& observed,
                                                     BackendEvents events) {
  if (player_) return std::nullopt;
  PlayerOptions po;
  po.post = [this](std::function<void()> fn) { scheduler_.post(std::move(fn)); };
  po.audioOnly = true;
  po.options = options;  // `vo` tenu par le lecteur ; le son suit `player/sound_policy.h`
  if (const char* log = std::getenv("TENTACLE_MUSIC_MPV_LOGFILE")) po.logFile = log;
  std::string error;
  player_ = Player::create(std::move(po), &error);
  if (!player_) return error.empty() ? std::string("Player::create a echoue") : error;
  for (const auto& [name, format] : observed)
    player_->observe(name, formatOf(format), [cb = events.property, name](const json& v) {
      if (cb) cb(name, valueOf(v));
    });
  player_->onEvent([events](const json& ev) {
    const std::string name = ev.value("event", "");
    const int64_t id = ev.value("playlist_entry_id", int64_t{-1});
    if (name == "start-file" && events.startFile) events.startFile(id);
    else if (name == "end-file" && events.endFile) events.endFile(id, ev.value("reason", 0), ev.value("error", 0));
    else if (name == "playback-restart" && events.playbackRestart) events.playbackRestart();
  });
  return std::nullopt;
}

bool PlayerAudioBackend::running() const { return player_ != nullptr; }

void PlayerAudioBackend::command(std::vector<std::string> args, Done done) {
  if (!player_) {
    if (done) done(std::string("mpv audio arrete"), nullptr);
    return;
  }
  player_->command(json(args), [done](std::optional<std::string> err, const json& result) {
    if (done) done(err, result);
  });
}

void PlayerAudioBackend::getProperty(const std::string& name, std::function<void(json)> done) {
  if (!player_) return done(nullptr);
  player_->getProperty(name, [done](std::optional<json> v) { done(v ? *v : json()); });
}

void PlayerAudioBackend::destroy(std::function<void()> done) {
  if (!player_) {
    if (done) done();
    return;
  }
  // Le `Player` vit jusqu'à la fin de son arrêt asynchrone, puis est rendu.
  Player* raw = player_.get();
  raw->destroy([this, done] {
    player_.reset();
    if (done) done();
  });
}

}  // namespace tentacle::music
