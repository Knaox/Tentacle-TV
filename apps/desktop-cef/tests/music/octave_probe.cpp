// Faux natif d'Octave : les scénarios du mode musique, joués contre libmpv
// seul (sans CEF ni fenêtre). Preuves par l'état, `time-pos`, les évènements
// et les propriétés de mpv — jamais par l'oreille (instance muette, volume 0).
//
//   octave_probe <http://127.0.0.1:port> <valeur Authorization> [ao]
#include <cctype>
#include <cstdlib>

#include "probe_harness.h"

using namespace tentacle::music;
using namespace tentacle::music::test;

namespace {

const std::string kMp3 = "Banc Octave/Carrés MP3/01 - Premier Carré.mp3";
const std::string kFil[] = {"Banc Octave/Sans Blanc/01 - Fil Un.flac", "Banc Octave/Sans Blanc/02 - Fil Deux.flac",
                            "Banc Octave/Sans Blanc/03 - Fil Trois.flac"};
const std::string kEclair = "Banc Octave/Sinus FLAC/03 - Éclair.flac";
const std::string kHiRes = "Haute Définition/Vingt-Quatre Bits/01 - Précision.flac";
const std::string kAac = "Trio Témoin/Aac du Matin/01 - Aube.m4a";
const std::string kOpus = "Trio Témoin/Opus de Nuit/01 - Minuit.opus";
const std::string kLong = "Banc Octave/Grand Format/01 - Six Minutes.flac";

double num(const json& j) { return j.is_number() ? j.get<double>() : -1; }

void title(const char* t) { std::printf("\n== %s\n", t); }

void startAndSilence(Harness& h, const std::string& auth) {
  title("1. audio_engine_start : capacités, instance muette, aucune sortie vidéo");
  auto [ok, caps] = h.call("audio_engine_start", {{"serverOrigin", h.base}, {"headers", {{"Authorization", auth}}},
                                                 {"volume", 1}, {"muted", false}, {"replayGain", "auto"},
                                                 {"deviceId", nullptr}, {"exclusive", false}});
  h.check(ok && caps.value("engine", "") == "mpv" && caps.value("gapless", false), "capacités : " + caps.dump());
  json vid = h.prop("vid"), vo = h.prop("vo"), mute = h.prop("mute"), vol = h.prop("volume");
  std::printf("  vid=%s vo=%s mute=%s volume=%s\n", vid.dump().c_str(), vo.dump().c_str(), mute.dump().c_str(),
              vol.dump().c_str());
  h.check((vid == false || vid == "no") && mute == true && vol == 0.0, "vid=no, mute=yes, volume=0 (son coupé)");
  h.check(h.prop("current-vo").is_null(), "aucune sortie vidéo créée (current-vo absent)");
}

void coverAndControls(Harness& h) {
  title("2. MP3 à pochette embarquée : lecture, pause/reprise, seek (piège jellium c5ad000)");
  auto [ok, _] = h.play(kMp3, 15000);
  h.check(ok && h.waitStatus("playing", 5000), "loading → playing");
  double p0 = h.pos();
  h.loop.runFor(3000);
  h.check(h.status() == "playing" && h.key() == kMp3 && h.pos() - p0 > 2500,
          "toujours le même titre après 3 s (pas de fin à ~1 s), time-pos " + std::to_string(p0) + " → " +
              std::to_string(h.pos()) + " ms");
  json tracks = h.prop("track-list");
  int images = 0, selectedVideo = 0;
  for (const auto& t : tracks)
    if (t.value("type", "") == "video") {
      images++;
      selectedVideo += t.value("selected", false);
    }
  h.check(images == 1 && selectedVideo == 0, "la pochette est une piste « video » NON choisie (" +
                                                   std::to_string(images) + " image, " +
                                                   std::to_string(selectedVideo) + " choisie)");
  std::printf("  audio-params=%s\n", h.prop("audio-params").dump().c_str());
  h.call("audio_control", {{"action", "pause"}});
  h.check(h.waitStatus("paused", 2000), "pause");
  h.loop.runFor(300);
  double a = num(h.prop("time-pos"));
  h.loop.runFor(1500);
  double b = num(h.prop("time-pos"));
  h.check(std::fabs(b - a) < 0.05, "en pause, time-pos immobile 1,5 s (" + std::to_string(a) + " → " + std::to_string(b) + ")");
  h.call("audio_control", {{"action", "resume"}});
  h.check(h.waitStatus("playing", 2000), "reprise");
  h.call("audio_control", {{"action", "seek"}, {"value", 10000}});
  h.loop.runFor(700);
  double s = num(h.prop("time-pos"));
  h.check(s >= 9.9 && s < 11.5, "seek 10 s → time-pos " + std::to_string(s));
  // La houle d'Octave : le niveau RMS mesuré par `astats` dans la chaîne (`audioLevel.ts`).
  h.loop.runFor(300);
  auto [okLevel, level] = h.call("audio_level");
  h.check(okLevel && level.is_number() && level.get<double>() <= 0 && level.get<double>() >= -120,
          "audio_level en lecture → " + level.dump() + " dBFS");
}

void gapless(Harness& h) {
  title("3. File : suivant sans blanc (« Sans Blanc »), fin de file = ended");
  size_t mark = h.events.size();
  h.play(kFil[0], 7000, 5000);
  h.setNext(kFil[1], 7000);
  h.waitStatus("playing", 4000);
  auto* adv = h.waitEvent("advanced", mark, 6000);
  h.check(adv && (*adv)["fromKey"] == kFil[0] && (*adv)["toKey"] == kFil[1], "advanced Fil Un → Fil Deux");
  // L'état suit l'annonce (Electron : `advanced`, puis l'état regroupé au tour suivant).
  h.loop.runFor(100);
  h.check(h.key() == kFil[1] && h.status() == "playing", "l'état suit : Fil Deux en lecture, sans « loading »");
  json pl = h.prop("playlist");
  h.check(pl.is_array() && pl.size() == 1, "liste mpv réduite au titre en cours (" + std::to_string(pl.size()) + ")");
  // La page renvoie le suivant après chaque `advanced` ; on saute vers la fin de Fil Deux.
  mark = h.events.size();
  h.setNext(kFil[2], 7000);
  h.call("audio_control", {{"action", "seek"}, {"value", 5500}});
  adv = h.waitEvent("advanced", mark, 6000);
  h.check(adv && (*adv)["toKey"] == kFil[2], "advanced Fil Deux → Fil Trois");
  h.call("audio_control", {{"action", "seek"}, {"value", 5500}});
  bool ended = h.waitStatus("ended", 6000);
  if (!ended) {
    for (const char* n : {"core-idle", "paused-for-cache", "seeking", "demuxer-cache-state", "audio-pts", "ao-volume"})
      std::printf("  diag %s=%s\n", n, h.prop(n).dump().c_str());
    std::printf("  diag : etat=%s eof=%s pause=%s time-pos=%s playlist=%s\n", h.lastState.dump().c_str(),
                h.prop("eof-reached").dump().c_str(), h.prop("pause").dump().c_str(), h.prop("time-pos").dump().c_str(),
                h.prop("playlist").dump().c_str());
  }
  h.check(ended, "fin du dernier titre → ended");
  h.loop.runFor(300);  // la dernière position de mpv suit l'état « ended » (règle d'Electron)
  // Electron dit la position de mpv sur sa fin (`keep-open`) : le début de la dernière trame
  // décodée (FLAC : 4 096 échantillons, 93 ms à 44,1 kHz), pas la durée — mesuré 6,83 s / 7 s.
  h.check(std::fabs(h.pos() - h.lastState.value("durationMs", 0.0)) < 300,
          "position ≈ durée à la fin (" + std::to_string(h.pos()) + " / " + std::to_string(h.lastState.value("durationMs", 0.0)) + ")");
  h.call("audio_control", {{"action", "resume"}});
  h.loop.runFor(600);
  h.check(h.status() == "playing" && h.pos() < 2000, "reprise après la fin : le titre repart du début");
}

void formats(Harness& h) {
  title("4. Changement de format 44,1 → 96 kHz, puis AAC et Opus jusqu'à leur fin");
  size_t mark = h.events.size();
  h.play(kEclair, 4000, 2500);
  h.setNext(kHiRes, 10000);
  auto* adv = h.waitEvent("advanced", mark, 6000);
  h.loop.runFor(800);
  double rate = h.lastState["format"].is_object() ? h.lastState["format"].value("sampleRate", 0.0) : 0;
  h.check(adv && rate == 96000, "advanced vers le 24/96, format décodé " + h.lastState["format"].dump());
  for (const auto& [path, dur] : {std::pair{kAac, 18000.0}, std::pair{kOpus, 14007.0}}) {
    h.play(path, dur, dur - 2500);
    h.check(h.waitStatus("playing", 4000), path + " : playing (" + h.lastState["format"].value("codec", "?") + ")");
    h.check(h.waitStatus("ended", 6000), path + " : ended");
  }
}

void videoClaim(Harness& h) {
  title("5. Bascule : une vidéo démarre pendant la musique → pause + commande système");
  h.play(kLong, 360000, 60000);
  h.check(h.waitStatus("playing", 4000), "musique en lecture");
  size_t mark = h.events.size();
  h.check(h.octave.onVideoClaim(), "onVideoClaim() : la musique jouait");
  auto* remote = h.waitEvent("remote", mark, 1000);
  h.check(remote && (*remote)["command"] == "pause", "évènement remote pause vers la page");
  h.check(h.waitStatus("paused", 1000) && h.prop("pause") == true, "mpv en pause, état paused");
  h.check(!h.octave.onVideoClaim(), "seconde réclamation : rien à faire");
  h.call("audio_control", {{"action", "resume"}});
  h.check(h.waitStatus("playing", 2000), "retour à la musique : reprise");
  h.call("audio_control", {{"action", "stop"}});
  h.check(h.waitStatus("idle", 1000), "stop → idle");
}

void guards(Harness& h) {
  title("6. Gardes : source hors du serveur, commandes avant le démarrage");
  auto [ok, err] = h.call("audio_play", {{"track", h.track("x", 1000)},
                                         {"source", {{"url", "http://127.0.0.2:1/x.flac"}, {"origin", "library"}}},
                                         {"startMs", 0}});
  h.check(!ok && err["code"] == "source_refused", "source d'une autre origine refusée : " + err.dump());
  auto [ok2, lvl] = h.call("audio_level");
  h.check(ok2 && lvl.is_null(), "audio_level hors lecture → null");
}

// Facultatif : le VRAI serveur Tentacle du banc (`OCTAVE_TENTACLE=<origine> <jeton> <id Jellyfin>`),
// la source telle que `/api/music/source/:id` la rend, l'en-tête que le front pose (`X-Emby-Token`).
void tentacleServer(Harness& h) {
  const char* env = std::getenv("OCTAVE_TENTACLE");
  if (!env) return;
  char origin[256], token[128], id[64];
  if (std::sscanf(env, "%255s %127s %63s", origin, token, id) != 3) return;
  title("8. Serveur Tentacle du banc : /api/music/stream/<id>, en-tête X-Emby-Token");
  auto [ok, caps] = h.call("audio_engine_start", {{"serverOrigin", origin}, {"headers", {{"X-Emby-Token", token}}},
                                                 {"volume", 1}, {"muted", false}, {"replayGain", "auto"},
                                                 {"deviceId", nullptr}, {"exclusive", false}});
  h.check(ok, "nouveau serveur, même instance");
  std::string key = std::string("jf:") + id;
  json source = {{"url", std::string(origin) + "/api/music/stream/" + id}, {"origin", "library"}, {"complete", true},
                 {"sizeBytes", nullptr}, {"durationMs", 12000}, {"replayGain", nullptr}, {"expiresAt", nullptr}};
  json track = {{"trackKey", key}, {"albumKey", nullptr}, {"durationMs", 12000},
                {"format", {{"codec", "flac"}, {"container", "flac"}, {"sampleRate", 44100}, {"bitDepth", 16},
                            {"bitrate", 240228}, {"channels", 2}, {"lossless", true}}}};
  h.call("audio_play", {{"track", track}, {"source", source}, {"startMs", 0}});
  h.check(h.waitStatus("playing", 5000), "Tentacle : playing");
  h.loop.runFor(1500);
  h.check(h.key() == key && h.pos() > 800 && h.lastState["format"].value("bitDepth", 0.0) == 16,
          "time-pos avance, format décodé + profondeur annoncée : " + h.lastState["format"].dump());
  h.call("audio_control", {{"action", "stop"}});
}

}  // namespace

int main(int argc, char** argv) {
  setenv("TENTACLE_MUTE", "1", 1);  // banc : jamais de son (player/sound_policy.h)
  if (argc < 3) {
    std::fprintf(stderr, "usage : octave_probe <base http> <Authorization> [ao]\n");
    return 2;
  }
  Options extra;
  if (argc > 3) extra.emplace_back("ao", argv[3]);
  Harness h(argv[1], extra);
  startAndSilence(h, argv[2]);
  coverAndControls(h);
  gapless(h);
  formats(h);
  videoClaim(h);
  guards(h);
  tentacleServer(h);
  title("7. audio_engine_stop : instance détruite");
  auto [ok, _] = h.call("audio_engine_stop");
  h.check(ok && h.octave.engine() == nullptr, "arrêt rendu, plus de moteur");
  auto [ok3, err] = h.call("audio_play", {{"track", h.track("x", 1)}, {"source", h.source("x", 1)}, {"startMs", 0}});
  h.check(!ok3 && err["code"] == "not_started", "après l'arrêt : not_started");
  h.loop.runFor(200);
  std::printf("\n%d vérifications, %d échec(s)\n", h.checks, h.failures);
  return h.failures == 0 ? 0 : 1;
}
