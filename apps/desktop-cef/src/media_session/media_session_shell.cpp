#include "media_session/media_session_shell.h"

#include <chrono>
#include <cstdio>
#include <map>
#include <memory>
#include <string>

#include "app/app.h"
#include "glue/pont_shell.h"
#include "media_session/artwork_fetch.h"
#include "media_session/media_session_hub.h"
#include "music/octave_shell.h"
#include "registry.h"
#include "shell/ipc.h"
#include "shell/main_thread.h"

namespace tentacle::media_session {
namespace {

using Json = nlohmann::json;

std::string str(const Json& j, const char* key) {
  auto it = j.find(key);
  return it != j.end() && it->is_string() ? it->get<std::string>() : std::string();
}

double monotonicMs() {
  using namespace std::chrono;
  return duration<double, std::milli>(steady_clock::now().time_since_epoch()).count();
}

struct State {
  std::unique_ptr<Hub> hub;
  bridge::Registry* registry = nullptr;
  // Vidéo : l'état dit par la page (`smtc_set_playback`) et ce que mpv dit de la position.
  Status videoStatus = Status::Stopped;
  double videoPosMs = 0;
  std::optional<double> videoDurMs;
  double videoRate = 1;
  // Musique : la fiche de chaque titre confié au moteur (`track.meta`), par clé.
  std::map<std::string, NowPlaying> musicMeta;
  std::string musicStatus = "idle";
  bool musicClaimed = false;
};
std::unique_ptr<State> st;

// --- Vidéo : le vocabulaire de `useSmtc` (`smtc-button`) ----------------------------------

const char* buttonOf(Command c) {
  switch (c) {
    case Command::Play: return "play";
    case Command::Pause: return "pause";
    case Command::Toggle: return "toggle";
    case Command::Stop: return "stop";
    case Command::Next: return "next";
    case Command::Previous: return "previous";
    case Command::Seek: return nullptr;  // la page ne sait pas sauter depuis le système
  }
  return nullptr;
}

void pushVideoPlayback() {
  Playback p;
  p.status = st->videoStatus;
  p.positionMs = st->videoPosMs;
  p.durationMs = st->videoDurMs;
  p.rate = st->videoRate;
  st->hub->setPlayback(Kind::Video, p);
}

void onVideoProperty(const std::string& name, const Json& v) {
  if (!st) return;
  if (name == "time-pos" && v.is_number()) st->videoPosMs = v.get<double>() * 1000;
  else if (name == "duration") st->videoDurMs = v.is_number() ? std::optional<double>(v.get<double>() * 1000) : std::nullopt;
  else if (name == "speed" && v.is_number()) st->videoRate = v.get<double>();
  else return;
  pushVideoPlayback();
}

void installVideoChannels(bridge::Registry& reg) {
  reg.event("smtc-button");
  reg.command("smtc_init", [](const Json&, bridge::Reply r) {
    st->hub->claim(Kind::Video, [](const CommandEvent& e) {
      if (const char* button = buttonOf(e.command)) st->registry->emit("smtc-button", button);
    });
    r.ok(nullptr);
  });
  reg.command("smtc_clear", [](const Json&, bridge::Reply r) {
    st->hub->release(Kind::Video);
    st->videoStatus = Status::Stopped;
    st->videoPosMs = 0;
    st->videoDurMs.reset();
    r.ok(nullptr);
  });
  reg.command("smtc_set_metadata", [](const Json& p, bridge::Reply r) {
    NowPlaying n;
    n.kind = Kind::Video;
    n.title = str(p, "title");
    n.artist = str(p, "artist");
    n.artworkUrl = str(p, "cover");
    st->hub->setNowPlaying(Kind::Video, n);
    r.ok(nullptr);
  });
  reg.command("smtc_set_playback", [](const Json& p, bridge::Reply r) {
    const std::string s = str(p, "status");
    if (!p.is_object() || !p.contains("status") || !p["status"].is_string()) return r.fail("invalid_args", "status attendu");
    st->videoStatus = s == "playing" ? Status::Playing : s == "paused" ? Status::Paused : Status::Stopped;
    pushVideoPlayback();
    r.ok(nullptr);
  });
  // Propre à CEF : la page dit ce que « suivant » et « précédent » feraient (`useSmtc`).
  reg.command("smtc_set_controls", [](const Json& p, bridge::Reply r) {
    st->hub->setControls(Kind::Video, Controls{p.value("next", false), p.value("previous", false), false});
    r.ok(nullptr);
  });
  reg.command("set_audio_session_name", [](const Json& p, bridge::Reply r) {
    const std::string name = str(p, "name");
    if (!name.empty()) st->hub->setAudioSessionName(name);
    r.ok(nullptr);
  });
}

// --- Musique : ce que le moteur d'Octave joue ---------------------------------------------

void rememberMeta(const Json& track) {
  if (!track.is_object() || !track.contains("meta") || !track["meta"].is_object()) return;
  const std::string key = str(track, "trackKey");
  if (key.empty()) return;
  const Json& m = track["meta"];
  NowPlaying n;
  n.kind = Kind::Music;
  n.title = str(m, "title");
  n.artist = str(m, "artist");
  n.album = str(m, "album");
  n.artworkUrl = str(m, "artworkUrl");
  if (st->musicMeta.size() > 64) st->musicMeta.clear();  // courant + suivant : jamais plus de quelques-uns
  st->musicMeta[key] = std::move(n);
}

void onMusicCall(const std::string& channel, const Json& args) {
  if (!st) return;
  if (channel == "audio_play" || channel == "audio_set_next") rememberMeta(args.value("track", Json()));
  if (channel == "audio_engine_stop") {
    st->hub->release(Kind::Music);
    st->musicClaimed = false;
    st->musicMeta.clear();
    st->musicStatus = "idle";
  }
}

void onMusicCommand(const CommandEvent& e) {
  const bool playing = st->musicStatus == "playing" || st->musicStatus == "loading" || st->musicStatus == "buffering";
  switch (e.command) {
    case Command::Play: return music::remoteCommand("play");
    case Command::Pause: return music::remoteCommand("pause");
    case Command::Toggle: return music::remoteCommand(playing ? "pause" : "play");
    case Command::Stop: return music::remoteCommand("stop");
    case Command::Next: return music::remoteCommand("next");
    case Command::Previous: return music::remoteCommand("previous");
    case Command::Seek: return music::seekFromSystem(e.positionMs);
  }
}

void onMusicEvent(const Json& event) {
  if (!st || str(event, "type") != "state" || !event.contains("state")) return;
  const Json& s = event["state"];
  st->musicStatus = str(s, "status");
  const std::string key = str(s, "trackKey");
  const auto meta = st->musicMeta.find(key);
  // Rien à montrer : au repos, ou une page qui n'envoie pas la fiche des titres.
  if (st->musicStatus == "idle" || key.empty() || meta == st->musicMeta.end()) {
    if (st->musicStatus == "idle" && st->musicClaimed) st->hub->release(Kind::Music);
    if (st->musicStatus == "idle") st->musicClaimed = false;
    return;
  }
  if (!st->musicClaimed) st->hub->claim(Kind::Music, onMusicCommand);
  st->musicClaimed = true;
  st->hub->setNowPlaying(Kind::Music, meta->second);
  Playback p;
  const bool waiting = st->musicStatus == "loading" || st->musicStatus == "buffering";
  p.status = st->musicStatus == "playing" || waiting ? Status::Playing : Status::Paused;
  p.rate = waiting ? 0 : 1;  // en attente de son, la barre ne court pas
  p.positionMs = s.value("positionMs", 0.0);
  if (s.contains("durationMs") && s["durationMs"].is_number()) p.durationMs = s["durationMs"].get<double>();
  st->hub->setControls(Kind::Music, Controls{true, true, p.durationMs.has_value()});
  st->hub->setPlayback(Kind::Music, p);
}

// --- Diagnostic des bancs (hors `window.tentacle`) -----------------------------------------

Json snapshotJson() {
  const Hub::Snapshot s = st->hub->snapshot();
  const char* shown = !s.shown ? nullptr : *s.shown == Kind::Music ? "music" : "video";
  Json out = {{"backend", st->hub->hasBackend()},
              {"shown", shown ? Json(shown) : Json(nullptr)},
              {"title", s.now.title},
              {"artist", s.now.artist},
              {"album", s.now.album},
              {"artwork", s.artwork},
              {"artworkBytes", s.artworkBytes},
              {"status", s.playback.status == Status::Playing ? "playing" : s.playback.status == Status::Paused ? "paused" : "stopped"},
              {"positionMs", s.playback.positionMs},
              {"durationMs", s.playback.durationMs ? Json(*s.playback.durationMs) : Json(nullptr)},
              {"rate", s.playback.rate},
              {"controls", {{"next", s.controls.next}, {"previous", s.controls.previous}, {"seek", s.controls.seek}}}};
  out["os"] = Json::parse(st->hub->backendState(), nullptr, false);
  return out;
}

Command commandOf(const std::string& name) {
  static const std::map<std::string, Command> m = {{"play", Command::Play},   {"pause", Command::Pause},
                                                   {"toggle", Command::Toggle}, {"stop", Command::Stop},
                                                   {"next", Command::Next},   {"previous", Command::Previous},
                                                   {"seek", Command::Seek}};
  auto it = m.find(name);
  return it == m.end() ? Command::Toggle : it->second;
}

void installDebugChannels() {
  ipc::registerHandler("media_session.debug.state", [](const Json&, ipc::Responder r) { r.reply(snapshotJson()); });
  // Le chemin d'une commande du système, sans le système : celui que prend le rappel de l'OS.
  ipc::registerHandler("media_session.debug.command", [](const Json& p, ipc::Responder r) {
    st->hub->dispatch({commandOf(p.value("command", "")), p.value("positionMs", 0.0)});
    r.reply(true);
  });
}

}  // namespace

void install(AppContext& ctx, bridge::Registry& registry) {
  if (st) return;
  st = std::make_unique<State>();
  st->registry = &registry;
  BackendHost host;
  host.sdlWindow = ctx.window;
  host.onCommand = [](CommandEvent e) {
    // Chaque commande du SYSTÈME, au journal : une touche qui « ne fait rien » ou une pause
    // venue d'ailleurs (le système qui reprend la main) se lit ici.
    static const char* kNames[] = {"play", "pause", "toggle", "stop", "next", "previous", "seek"};
    std::fprintf(stderr, "[media-session] commande du système : %s\n", kNames[static_cast<int>(e.command)]);
    postToMain([e] {
      if (st) st->hub->dispatch(e);
    });
  };
  auto backend = createBackend(host);
  if (!backend) std::fprintf(stderr, "[media-session] le système n'offre pas « À l'écoute » : rien ne s'affichera\n");
  st->hub = std::make_unique<Hub>(std::move(backend), fetchArtwork, monotonicMs);
  installVideoChannels(registry);
  pont::setVideoPropertyObserver(onVideoProperty);
  music::observeMusic(onMusicCall, onMusicEvent);
  installDebugChannels();
}

void shutdown() {
  if (!st) return;
  music::observeMusic({}, {});
  pont::setVideoPropertyObserver({});
  st.reset();  // `~Hub` retire la session : les touches reviennent au système
}

}  // namespace tentacle::media_session
