// Faux natif d'Octave — joue le rôle de la PAGE : appelle les canaux `audio_*`
// comme `bridgeAudioEngine.ts` de Tentacle, garde les évènements `audio://event`,
// et compte les vérifications. Aucune lecture audible : mpv naît muet (volume 0).
#pragma once

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "event_loop.h"
#include "music/audio_engine.h"
#include "music/mpv_audio_backend.h"
#include "music/octave_channels.h"
#ifdef TENTACLE_MUSIC_HAS_PLAYER
#include "music/player_audio_backend.h"
#endif

namespace tentacle::music::test {

using json = nlohmann::json;

struct Harness {
  EventLoop loop;
  OctaveChannels octave;
  std::string base;  // http://127.0.0.1:<port>
  std::vector<json> events;
  json lastState;
  int failures = 0, checks = 0;

  Harness(std::string baseUrl, Options extra)
      : octave(loop, [this]() -> std::unique_ptr<AudioBackend> {
#ifdef TENTACLE_MUSIC_HAS_PLAYER
          return std::make_unique<PlayerAudioBackend>(loop);  // le lecteur de vidéo-HDR, audio seul
#else
          return std::make_unique<MpvAudioBackend>(loop);
#endif
        }, std::move(extra)),
        base(std::move(baseUrl)) {
    octave.install([](const std::string&, OctaveChannels::Handler) {},
                   [this](const std::string& ev, json payload) {
                     if (ev != OctaveChannels::kEvent) return;
                     if (payload["type"] == "state") lastState = payload["state"];
                     else std::printf("  evenement %s\n", payload.dump().c_str());
                     events.push_back(std::move(payload));
                   });
  }

  void check(bool ok, const std::string& what) {
    checks++;
    if (!ok) failures++;
    std::printf("  [%s] %s\n", ok ? "ok" : "ECHEC", what.c_str());
  }

  // Une commande, attendue jusqu'à sa réponse. Rend {ok, valeur ou erreur}.
  std::pair<bool, json> call(const std::string& channel, json args = json::object(), int timeoutMs = 5000) {
    bool done = false, ok = false;
    json value;
    octave.dispatch(channel, args, [&](json v) { done = ok = true; value = std::move(v); },
                    [&](std::string code, std::string msg) {
                      done = true;
                      value = {{"code", code}, {"message", msg}};
                    });
    loop.runUntil([&] { return done; }, timeoutMs);
    if (!done) value = {{"code", "timeout"}};
    return {ok, value};
  }

  json prop(const std::string& name) {
    json v;
    bool done = false;
    if (!octave.engine()) return nullptr;
    octave.engine()->readProperty(name, [&](json r) { v = std::move(r); done = true; });
    loop.runUntil([&] { return done; }, 3000);
    return v;
  }

  std::string status() const { return lastState.is_object() ? lastState.value("status", "") : ""; }
  double pos() const { return lastState.is_object() ? lastState.value("positionMs", 0.0) : 0.0; }
  std::string key() const {
    return lastState.is_object() && lastState["trackKey"].is_string() ? lastState["trackKey"].get<std::string>() : "";
  }

  bool waitStatus(const std::string& s, int timeoutMs) {
    return loop.runUntil([&] { return status() == s; }, timeoutMs);
  }

  // Attend un évènement du type donné arrivé APRÈS l'index `from`.
  const json* waitEvent(const std::string& type, size_t from, int timeoutMs) {
    const json* found = nullptr;
    loop.runUntil([&] {
      for (size_t i = from; i < events.size(); i++)
        if (events[i]["type"] == type) return (found = &events[i]) != nullptr;
      return false;
    }, timeoutMs);
    return found;
  }

  static std::string encode(const std::string& path) {
    std::string out;
    for (unsigned char c : path) {
      if (std::isalnum(c) || c == '/' || c == '-' || c == '.' || c == '_') out += static_cast<char>(c);
      else {
        char b[4];
        std::snprintf(b, sizeof b, "%%%02X", c);
        out += b;
      }
    }
    return out;
  }

  json track(const std::string& path, double durationMs) {
    return {{"trackKey", path}, {"albumKey", path.substr(0, path.rfind('/'))}, {"durationMs", durationMs},
            {"format", nullptr}};
  }
  json source(const std::string& path, double durationMs) {
    return {{"url", base + "/" + encode(path)}, {"origin", "library"}, {"complete", true}, {"sizeBytes", nullptr},
            {"durationMs", durationMs}, {"replayGain", nullptr}, {"expiresAt", nullptr}};
  }
  std::pair<bool, json> play(const std::string& path, double durationMs, double startMs = 0) {
    return call("audio_play", {{"track", track(path, durationMs)}, {"source", source(path, durationMs)},
                               {"startMs", startMs}});
  }
  std::pair<bool, json> setNext(const std::string& path, double durationMs) {
    return call("audio_set_next", {{"track", track(path, durationMs)}, {"source", source(path, durationMs)}});
  }
};

}  // namespace tentacle::music::test
