// Relais d'Octave : le VRAI moteur musique (`OctaveChannels`) piloté ligne à
// ligne en JSON sur stdin/stdout — pour le brancher au vrai front de Tentacle
// dans un Chrome sans tête (`web/shim/octave-relay.mjs`) avant le socle.
//
//   entrée  : {"id":1,"channel":"audio_play","args":{…}}
//             canaux de banc : "__claim" (une vidéo démarre), "__prop" {name}
//   sortie  : {"id":1,"ok":true,"value":…} | {"id":1,"ok":false,"code":…,"message":…}
//             {"event":"audio://event","payload":{…}}
// Muet : volume 0 et mute forcés par le moteur, `ao=null` par défaut.
#include <atomic>
#include <cstdlib>
#include <cstdio>
#include <iostream>
#include <string>
#include <thread>

#include "event_loop.h"
#include "music/audio_engine.h"
#include "music/mpv_audio_backend.h"
#include "music/octave_channels.h"
#ifdef TENTACLE_MUSIC_HAS_PLAYER
#include "music/player_audio_backend.h"
#endif

using namespace tentacle::music;
using json = nlohmann::json;

namespace {

void writeLine(const json& j) {
  std::string s = j.dump(-1, ' ', false, json::error_handler_t::replace);
  std::fwrite(s.data(), 1, s.size(), stdout);
  std::fputc('\n', stdout);
  std::fflush(stdout);
}

}  // namespace

int main(int argc, char** argv) {
  setenv("TENTACLE_MUTE", "1", 1);  // banc : jamais de son (player/sound_policy.h)
  test::EventLoop loop;
  Options extra = {{"ao", argc > 1 ? argv[1] : "null"}};
  OctaveChannels octave(loop, [&loop]() -> std::unique_ptr<AudioBackend> {
#ifdef TENTACLE_MUSIC_HAS_PLAYER
    return std::make_unique<PlayerAudioBackend>(loop);
#else
    return std::make_unique<MpvAudioBackend>(loop);
#endif
  }, extra);
  octave.install([](const std::string&, OctaveChannels::Handler) {},
                 [](const std::string& event, json payload) {
                   writeLine({{"event", event}, {"payload", std::move(payload)}});
                 });

  std::atomic<bool> closed{false};
  std::thread reader([&] {
    std::string line;
    while (std::getline(std::cin, line)) {
      loop.post([&octave, line] {
        json msg = json::parse(line, nullptr, false);
        if (!msg.is_object()) return;
        json id = msg.value("id", json());
        std::string channel = msg.value("channel", "");
        json args = msg.value("args", json::object());
        auto ok = [id](json v) { writeLine({{"id", id}, {"ok", true}, {"value", std::move(v)}}); };
        auto fail = [id](std::string code, std::string m) {
          writeLine({{"id", id}, {"ok", false}, {"code", code}, {"message", m}});
        };
        if (channel == "__claim") return ok(octave.onVideoClaim());
        if (channel == "__prop") {
          if (!octave.engine()) return ok(nullptr);
          return octave.engine()->readProperty(args.value("name", ""), ok);
        }
        octave.dispatch(channel, args, ok, fail);
      });
    }
    // Après les lignes déjà postées (file FIFO) : leurs réponses partent d'abord.
    loop.post([&closed] { closed = true; });
  });
  // Fin de l'entrée : le moteur s'arrête proprement (`quit`, puis SHUTDOWN), et on sort.
  loop.runUntil([&] { return closed.load(); }, 24 * 3600 * 1000);
  loop.runFor(300);  // les réponses asynchrones en vol
  bool stopped = false;
  octave.dispatch("audio_engine_stop", json::object(), [&](json) { stopped = true; },
                  [&](std::string, std::string) { stopped = true; });
  loop.runUntil([&] { return stopped; }, 5000);
  reader.join();
  return 0;
}
