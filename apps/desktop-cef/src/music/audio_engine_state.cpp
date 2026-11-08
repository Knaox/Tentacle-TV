// Octave — l'état du moteur tel que la page le reçoit, dérivé de ce que mpv
// dit (propriétés observées) et de ce que le moteur sait (pause voulue,
// chargement, fin, erreur). Même règle que Tentacle (`audioEngineState.ts`).
#include "music/audio_engine.h"

namespace tentacle::music {
namespace {
using json = nlohmann::json;
using Clock = std::chrono::steady_clock;
constexpr int kStateIntervalMs = 250;
}  // namespace

std::string AudioEngine::status() const {
  if (flags_.error) return "error";
  if (!current_) return "idle";
  if (flags_.ended) return "ended";
  // Seul un CHARGEMENT dit « loading » : au passage sans blanc d'un titre au
  // suivant, `time-pos` disparaît un instant sans que rien ne s'arrête.
  if (flags_.awaitingRestart) return "loading";
  if (props_.pausedForCache) return "buffering";
  return flags_.wantPaused ? "paused" : "playing";
}

BridgeState AudioEngine::state() const {
  BridgeState s;
  s.status = status();
  s.volume = settings_.volume;
  s.muted = settings_.muted;  // la DEMANDE de la page (l'instance, elle, reste muette)
  s.deviceId = settings_.deviceId;
  s.error = flags_.error;
  if (!current_) return s;
  s.trackKey = current_->track.trackKey;
  // La durée MESURÉE par mpv l'emporte sur l'annoncée (Tentacle, lot « fl »).
  if (current_->source.complete && props_.duration && *props_.duration > 0)
    s.durationMs = *props_.duration * 1000;
  else
    s.durationMs = current_->source.durationMs ? current_->source.durationMs : current_->track.durationMs;
  if (props_.timePos)
    s.positionMs = *props_.timePos * 1000;
  else if (flags_.awaitingRestart)
    s.positionMs = current_->startS * 1000;
  if (flags_.ended && s.durationMs) s.positionMs = *s.durationMs;
  if (props_.codec) {
    AudioFormat f;
    f.codec = *props_.codec;
    f.container = props_.fileFormat;
    f.sampleRate = props_.sampleRate;
    f.channels = props_.channels;
    f.bitrate = props_.bitrate;
    // La profondeur de bits, le décodeur ne la dit pas : celle de la bibliothèque.
    if (current_->track.format) f.bitDepth = current_->track.format->bitDepth;
    f.lossless = isLossless(f.codec);
    s.format = f;
  } else {
    s.format = current_->track.format;
  }
  return s;
}

// L'état part au plus quatre fois par seconde pour la position, tout de suite sinon.
void AudioEngine::emitState(bool throttled) {
  auto now = Clock::now();
  auto since = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastState_).count();
  if (!throttled || since >= kStateIntervalMs) return sendState();
  if (statePending_) return;
  statePending_ = true;
  std::weak_ptr<bool> alive = alive_;
  scheduler_.postDelayed(static_cast<int>(kStateIntervalMs - since), [this, alive] {
    if (alive.expired() || !statePending_) return;
    sendState();
  });
}

void AudioEngine::sendState() {
  statePending_ = false;
  json state = toJson(this->state());
  if (state == lastSent_) return;
  lastSent_ = state;
  lastState_ = Clock::now();
  auto at = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count();
  emit_({{"type", "state"}, {"state", std::move(state)}, {"at", at}});
}

}  // namespace tentacle::music
