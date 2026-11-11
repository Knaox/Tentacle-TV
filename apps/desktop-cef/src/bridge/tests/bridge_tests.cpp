#include <algorithm>
// Tests du pont : formes des charges attendues par le front de Tentacle, listes
// blanches, étranglement, plein écran. Sans dépendance de test : un échec imprime
// sa ligne et le code de sortie compte les échecs.
#include <cstdio>
#include <string>

#include "mpv_policy.h"
#include "registry.h"
#include "tests/fakes.h"
#include "video_channels.h"
#include "video_probe.h"
#include "window_channels.h"

using namespace bridge;
using namespace bridge::testing;

static int failures = 0;
#define CHECK(cond)                                                     \
  do {                                                                  \
    if (!(cond)) {                                                      \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                       \
    }                                                                   \
  } while (0)

// La charge exacte de `mpv_init` envoyée par le front (macOS, `buildMpvInitOptions`).
static Json frontInit() {
  return Json::parse(R"({"options":{
    "initialOptions":{"vo":"gpu-next","hwdec":"videotoolbox,videotoolbox-copy","keep-open":"yes",
      "force-window":"no","gpu-api":"vulkan","gpu-context":"macvk","target-colorspace-hint":"yes",
      "border":"no","cache":"yes","cache-pause-wait":15,"osd-level":0,"subprocess":"x"},
    "observedProperties":[["pause","flag"],["time-pos","double","none"],["aid","int64"],["eof-reached","flag"]]}})");
}

static void testRegistry() {
  FakeIpc ipc;
  Registry reg(ipc);
  reg.command("mpv_init", [](const Json&, Reply r) { r.ok("ok"); });
  reg.event("mpv://event");
  CHECK(ipc.handlers.count("tentacle:mpv_init") == 1);
  CHECK(reg.commands() == std::vector<std::string>{"mpv_init"});
  bool threw = false;
  try { reg.command("mpv_init", [](const Json&, Reply) {}); } catch (const std::logic_error&) { threw = true; }
  CHECK(threw);
  threw = false;
  try { reg.emit("audio://event", nullptr); } catch (const std::logic_error&) { threw = true; }
  CHECK(threw);
  reg.emit("mpv://event", {{"event", "idle"}});
  CHECK(ipc.emitted.at(0).first == "tentacle:mpv://event");

  ShimConfig cfg{{"http://127.0.0.1:3471"}, "http://127.0.0.1:3471", "1.42.0", "darwin", 0};
  const std::string script = reg.injectedScript(embeddedShimSource(), cfg);
  CHECK(script.find("__TENTACLE_SHIM_CONFIG__") == std::string::npos);
  CHECK(script.find(R"("commands":["mpv_init"])") != std::string::npos);
  CHECK(script.find(R"("platform":"darwin")") != std::string::npos);
  // ASCII seul : U+2028 deviendrait un   inoffensif.
  cfg.version = "1.42 ";
  CHECK(reg.injectedScript(embeddedShimSource(), cfg).find("\\u2028") != std::string::npos);
}

static void testPolicy() {
  using namespace mpv_policy;
  CHECK(refuseCommand("run", {"/bin/sh"}).has_value());
  CHECK(refuseCommand("subprocess", {}).has_value());
  CHECK(refuseCommand("load-script", {"x.lua"}).has_value());
  CHECK(!refuseCommand("set", {"aid", "2"}).has_value());
  CHECK(!refuseCommand("set", {"hr-seek-demuxer-offset", "0"}).has_value());
  CHECK(refuseCommand("set", {"tone-mapping", "clip"}).has_value());  // chaîne de couleur : vidéo-HDR
  CHECK(refuseCommand("loadfile", {"u", "replace"}).has_value());     // arité 1, comme Electron
  CHECK(!refuseCommand("seek", {"30", "relative"}).has_value());
  const auto f = filterInitOptions(frontInit()["options"]["initialOptions"]);
  CHECK(f.kept.value("keep-open", "") == "yes");
  CHECK(f.kept.value("cache-pause-wait", "") == "15");
  CHECK(!f.kept.contains("vo") && !f.kept.contains("gpu-context") && !f.kept.contains("force-window"));
  CHECK(f.ownedByPlayer.size() == 6);
  CHECK(f.refused == std::vector<std::string>{"subprocess"});
  CHECK(coerce("yes", "flag") == true);
  CHECK(coerce("3", "int64") == 3.0);
  CHECK(coerce(Json(nullptr), "string").is_null());
  CHECK(toMpvString(true) == "yes");
}

static void testVideo() {
  FakeIpc ipc;
  FakePlayer player;
  Registry reg(ipc);
  double now = 1000;
  VideoChannels video(reg, player, [&now] { return now; });
  bool claimed = false;
  video.setOnVideoClaim([&claimed] { claimed = true; });

  auto a = ipc.invoke("tentacle:mpv_init", frontInit());
  CHECK(a.ok && a.value == "ok");
  CHECK(claimed);
  CHECK(player.started.size() == 1 && !player.started[0].contains("vo"));
  CHECK(player.observed.size() == 4 && player.observed[1].first == "time-pos");

  // time-pos à 8 Hz : la 2e valeur, 50 ms plus tard, est retenue puis libérée par `pause`.
  player.listener->onProperty("time-pos", 1.0);
  now += 50;
  player.listener->onProperty("time-pos", 1.05);
  CHECK(ipc.payloadsOf("tentacle:mpv://property-change").size() == 1);
  player.listener->onProperty("pause", true);
  auto changes = ipc.payloadsOf("tentacle:mpv://property-change");
  CHECK(changes.size() == 3);
  CHECK(changes[1]["data"] == 1.05 && changes[2]["name"] == "pause");
  CHECK(changes[2]["id"] == 1 && changes[2]["at"] == 1050.0);
  // En pause, rien d'autre ne bouge : la retenue part PAR LE TEMPS (pompe d'Electron, 20 ms).
  {
    FakeIpc ipc2;
    FakePlayer player2;
    Registry reg2(ipc2);
    double t = 5000;
    std::vector<std::pair<int, std::function<void()>>> deferred;
    VideoChannels v2(reg2, player2, [&t] { return t; }, [&deferred](int ms, std::function<void()> f) { deferred.emplace_back(ms, std::move(f)); });
    ipc2.invoke("tentacle:mpv_init", frontInit());
    player2.listener->onProperty("time-pos", 2.0);
    t += 40;
    player2.listener->onProperty("time-pos", 2.04);
    CHECK(ipc2.payloadsOf("tentacle:mpv://property-change").size() == 1);
    CHECK(deferred.size() == 1 && deferred[0].first == 86);
    t += 86;
    deferred[0].second();
    auto held = ipc2.payloadsOf("tentacle:mpv://property-change");
    CHECK(held.size() == 2 && held[1]["data"] == 2.04 && held[1]["at"] == 5040.0);
  }
  player.listener->onProperty("vf", "x");  // non observée par la page : rien
  CHECK(ipc.payloadsOf("tentacle:mpv://property-change").size() == 3);

  player.listener->onEvent({{"event", "end-file"}, {"reason", 4}, {"error", -13}});
  CHECK(ipc.payloadsOf("tentacle:mpv://event").at(0)["reason"] == 4);

  a = ipc.invoke("tentacle:mpv_command", {{"name", "seek"}, {"args", {30, "relative"}}});
  CHECK(a.ok && player.commands.back() == Json({"seek", "30", "relative"}));
  a = ipc.invoke("tentacle:mpv_command", {{"name", "run"}, {"args", {"/bin/sh"}}});
  CHECK(!a.ok && a.message == "commande refusee : run");
  player.commandError = "property not found";
  a = ipc.invoke("tentacle:mpv_command", {{"name", "set"}, {"args", {"sid", "9"}}});
  CHECK(!a.ok && a.message == "set : property not found");  // jamais les arguments

  a = ipc.invoke("tentacle:mpv_set_property", {{"name", "volume"}, {"value", 40}});
  CHECK(a.ok && player.writes["volume"] == 40);
  player.values["track-list/0/selected"] = "yes";
  a = ipc.invoke("tentacle:mpv_get_property", {{"name", "track-list/0/selected"}, {"format", "flag"}});
  CHECK(a.ok && a.value == true);
  a = ipc.invoke("tentacle:mpv_get_property", {{"name", "track-list/9/id"}, {"format", "int64"}});
  CHECK(a.ok && a.value.is_null());

  a = ipc.invoke("tentacle:mpv_init", frontInit());  // épisode suivant : l'ancienne part d'abord
  CHECK(a.ok && player.stops == 1 && player.started.size() == 2);
  a = ipc.invoke("tentacle:mpv_destroy");
  CHECK(a.ok && player.stops == 2 && !player.running());
  a = ipc.invoke("tentacle:mpv_command", {{"name", "seek"}, {"args", {1}}});
  CHECK(!a.ok && a.code == "no_player");
}

// Pannes provoquées du lecteur (mpv_fault.h) : chaque mode donne à la page ce qu'un vrai
// mpv en panne lui donnerait — c'est ce qui éprouve le repli vers le lecteur web.
static void testFault() {
  CHECK(parseMpvFault("fatal") == MpvFault::Fatal && parseMpvFault("") == MpvFault::Off);
  CHECK(!parseMpvFault("casse") && std::string(mpvFaultName(MpvFault::Stall)) == "stall");
  {  // init : mpv_init refusé, mpv jamais démarré ; `off` rend le lecteur.
    FakeIpc ipc; FakePlayer player; Registry reg(ipc);
    VideoChannels video(reg, player, {}, {}, MpvFault::Init);
    auto a = ipc.invoke("tentacle:mpv_init", frontInit());
    CHECK(a.done && !a.ok && a.code == "mpv_init" && player.started.empty());
    a = ipc.invoke("tentacle:mpv_debug_fail", {{"mode", "off"}});
    CHECK(a.ok && a.value["mode"] == "off" && a.value["fired"] == false);
    CHECK(ipc.invoke("tentacle:mpv_init", frontInit()).ok && player.started.size() == 1);
  }
  {  // stall : aucune réponse ; lever la panne rend la main à la page (un refus, pas un silence).
    FakeIpc ipc; FakePlayer player; Registry reg(ipc);
    VideoChannels video(reg, player);
    CHECK(ipc.invoke("tentacle:mpv_debug_fail", {{"mode", "stall"}}).value["mode"] == "stall");
    Answer pending;
    Reply reply{[&pending](Json v) { pending.done = pending.ok = true; pending.value = std::move(v); },
                [&pending](std::string c, std::string m) { pending.done = true; pending.code = std::move(c); pending.message = std::move(m); }};
    ipc.handlers["tentacle:mpv_init"](frontInit(), reply);
    CHECK(!pending.done && player.started.empty());
    ipc.invoke("tentacle:mpv_debug_fail", {{"mode", "off"}});
    CHECK(pending.done && !pending.ok && pending.code == "mpv_init");
  }
  {  // load : `loadfile` accepté, jamais transmis à mpv, puis `end-file` en erreur de chargement.
    FakeIpc ipc; FakePlayer player; Registry reg(ipc);
    VideoChannels video(reg, player, {}, {}, MpvFault::Load);
    CHECK(ipc.invoke("tentacle:mpv_init", frontInit()).ok);
    auto a = ipc.invoke("tentacle:mpv_command", {{"name", "loadfile"}, {"args", {"http://serveur/film?api_key=secret"}}});
    CHECK(a.ok && player.commands.empty());
    auto events = ipc.payloadsOf("tentacle:mpv://event");
    CHECK(events.size() == 1 && events[0]["event"] == "end-file" && events[0]["reason"] == 4 && events[0]["error"] == -13);
    a = ipc.invoke("tentacle:mpv_command", {{"name", "seek"}, {"args", {5}}});  // le reste passe
    CHECK(a.ok && player.commands.size() == 1);
  }
  {  // fatal, en route : la position retenue part D'ABORD, puis `end-file` en erreur, et mpv s'arrête.
    FakeIpc ipc; FakePlayer player; Registry reg(ipc);
    double now = 1000;
    VideoChannels video(reg, player, [&now] { return now; });
    auto a = ipc.invoke("tentacle:mpv_debug_fail", {{"mode", "fatal"}});
    CHECK(a.ok && a.value["fired"] == false);  // rien ne joue : rien ne tombe
    ipc.invoke("tentacle:mpv_init", frontInit());
    player.listener->onProperty("time-pos", 61.0);
    now += 40;
    player.listener->onProperty("time-pos", 61.04);  // retenue par l'étranglement
    a = ipc.invoke("tentacle:mpv_debug_fail", {{"mode", "fatal"}});
    CHECK(a.ok && a.value["fired"] == true && a.value["mode"] == "off");
    CHECK(ipc.emitted.size() == 3 && ipc.emitted[1].second["data"] == 61.04);
    CHECK(ipc.emitted[2].first == "tentacle:mpv://event" && ipc.emitted[2].second["reason"] == 4 && ipc.emitted[2].second["error"] == -20);
    CHECK(player.commands.back() == Json::array({"stop"}));
  }
  {  // fatal, au lancement : armé, il tire dix secondes après le départ de la PREMIÈRE lecture, une fois.
    FakeIpc ipc; FakePlayer player; Registry reg(ipc);
    std::vector<std::pair<int, std::function<void()>>> deferred;
    VideoChannels video(reg, player, {}, [&deferred](int ms, std::function<void()> f) { deferred.emplace_back(ms, std::move(f)); }, MpvFault::Fatal);
    CHECK(ipc.invoke("tentacle:mpv_init", frontInit()).ok);  // mpv démarre normalement
    player.listener->onEvent({{"event", "playback-restart"}});
    CHECK(deferred.size() == 1 && deferred[0].first == 10000);
    deferred[0].second();
    CHECK(ipc.payloadsOf("tentacle:mpv://event").back()["error"] == -20);
    player.listener->onEvent({{"event", "playback-restart"}});
    CHECK(deferred.size() == 1);
  }
  {  // absent : aucun canal mpv_* (la page ne voit pas de lecteur natif) ; jamais posé en route.
    FakeIpc ipc; FakePlayer player; Registry reg(ipc);
    VideoChannels video(reg, player, {}, {}, MpvFault::Absent);
    CHECK(!ipc.handlers.count("tentacle:mpv_init") && !ipc.handlers.count("tentacle:mpv_command"));
    auto a = ipc.invoke("tentacle:mpv_debug_fail", {{"mode", "absent"}});
    CHECK(a.done && !a.ok && a.code == "launch_only");
    a = ipc.invoke("tentacle:mpv_debug_fail", {{"mode", "casse"}});
    CHECK(a.done && !a.ok && a.code == "bad_mode");
  }
}

static void testWindow() {
  FakeIpc ipc;
  FakeWindow win;
  Registry reg(ipc);
  WindowChannels channels(reg, win);
  auto a = ipc.invoke("tentacle:player_fullscreen_enter");
  CHECK(a.ok && a.value == false);
  a = ipc.invoke("tentacle:toggle_fullscreen");
  CHECK(a.ok && a.value == true && win.requested.back() == true);
  channels.fullscreenChanged(true);
  channels.fullscreenChanged(true);  // une seule émission par changement réel
  CHECK(ipc.payloadsOf("tentacle:window://fullscreen") == std::vector<Json>{true});
  // `open-external` n'est plus une commande de la liste : comme sous Electron, c'est une
  // capacité nommée de la coquille (src/lifecycle, liste fermée de `security.ts`).
  a = ipc.invoke("tentacle:open-external", {{"url", "https://tentacletv.app"}});
  CHECK(!a.ok && win.opened.empty());
  CHECK(std::find(reg.commands().begin(), reg.commands().end(), "open-external") == reg.commands().end());
  ipc.invoke("tentacle:prevent_display_sleep_start");
  CHECK(win.sleepBlocked);
}

// La sonde de surface (dev) : une capture BMP lue comme Electron (`macosCapture.ts`).
static std::vector<uint8_t> bmp(int w, int h, bool noisy) {
  std::vector<uint8_t> b(54 + size_t(w) * h * 4, 0);
  auto put32 = [&b](size_t at, uint32_t v) { for (int k = 0; k < 4; k++) b[at + k] = uint8_t(v >> (8 * k)); };
  b[0] = 'B', b[1] = 'M';
  put32(10, 54);
  put32(18, uint32_t(w));
  put32(22, uint32_t(-h));  // de haut en bas
  b[28] = 32;
  for (int i = 0; i < w * h; i++)
    for (int c = 0; c < 3; c++) b[54 + size_t(i) * 4 + c] = noisy ? uint8_t((i * 37 + c * 91) % 256) : 0;
  return b;
}

static void testProbe() {
  probe::ImageStats black, image;
  CHECK(!probe::statsFromBmp(bmp(64, 64, false), black));
  CHECK(black.largeur == 64 && black.hauteur == 64 && black.nonNoirs == 0 && black.stdDev == 0);
  CHECK(probe::verdict(black, std::nullopt).rfind("RIEN A VOIR", 0) == 0);
  CHECK(!probe::statsFromBmp(bmp(64, 64, true), image));
  CHECK(image.nonNoirs > 0.35 && image.stdDev > 4 && image.teintes > 10);
  CHECK(probe::verdict(image, std::nullopt).rfind("IMAGE VISIBLE", 0) == 0);
  probe::ImageStats bad;
  CHECK(probe::statsFromBmp({1, 2, 3}, bad).has_value());
  CHECK(probe::verdict(std::nullopt, std::string("autorisation")) == "INDETERMINE — autorisation");
}

int main() {
  testProbe();
  testRegistry();
  testPolicy();
  testVideo();
  testFault();
  testWindow();
  std::printf(failures ? "%d échec(s)\n" : "tous les tests du pont passent\n", failures);
  return failures ? 1 : 0;
}
