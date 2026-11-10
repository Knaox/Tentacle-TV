// Règles pures du moteur — port de `audioRules.test.ts`, `audioLevel.test.ts`,
// `crossfadeFilter.test.ts` (filtre et minutage) d'Electron, cas pour cas.
#include <string>
#include <vector>

#include "music/audio_options.h"
#include "music/crossfade_rules.h"
#include "music/engine_state.h"
#include "music/native_engine.h"
#include "music/tests/test_kit.h"

using namespace tentacle::music;
using namespace tentacle::music::testing;
using json = nlohmann::json;

static void options() {
  CHECK(formatFileOptions({{"start", "12.5"}, {"volume-gain", "-3.00"}}) == "start=12.5,volume-gain=-3.00");
  CHECK(formatFileOptions(partialStreamOptions(false)).rfind("stream-lavf-o=%", 0) == 0);
  CHECK(formatFileOptions({{"title", "é,x"}}) == "title=%4%é,x");
  CHECK(edlFrom("http://s/a,b;c", 1.5) == "edl://%14%http://s/a,b;c,start=1.500000,length=86400");
  CHECK(edlFrom("http://s/é", 2) == "edl://%11%http://s/é,start=2.000000,length=86400");
  CHECK(partialStreamOptions(true).empty());
  std::vector<std::string> h;
  CHECK(!headerLines({{"X-Emby-Token", "abc"}}, h) && h == std::vector<std::string>{"X-Emby-Token: abc"});
  CHECK(headerLines({{"X-Emby-Token", "a\r\nX: y"}}, h));
  CHECK(headerLines({{"X Token", "a"}}, h));
  // Écart VOULU avec Electron : la virgule passe (un en-tête par élément de `change-list`).
  h.clear();
  CHECK(!headerLines({{"Authorization", "MediaBrowser a=\"1\", Token=\"t\""}}, h));
  const double t = swapPoint(1, 44100, 1.5);
  CHECK_NEAR(t * 44100, std::floor(2.5 * 44100) + 0.5, 1e-6);
  CHECK(swapPoint(1, std::nullopt, 1.5) == 2.5);
  CHECK((outputOptions(Platform::Darwin, std::nullopt, true) ==
         Options{{"audio-device", "auto"}, {"audio-exclusive", "yes"}, {"coreaudio-change-physical-format", "yes"}}));
  CHECK((outputOptions(Platform::Win32, "wasapi/{x}", true) == Options{{"audio-device", "wasapi/{x}"}, {"audio-exclusive", "yes"}}));
  CHECK((outputOptions(Platform::Linux, "pipewire/a", false) == Options{{"audio-device", "pipewire/a"}, {"audio-exclusive", "no"}}));
}

static void outputs() {
  json mac = json::array({{{"name", "auto"}, {"description", "Autoselect device"}},
                          {{"name", "coreaudio/BuiltInSpeakerDevice"}, {"description", "Haut-parleurs MacBook Pro"}},
                          {{"name", "avfoundation/BuiltInSpeakerDevice"}, {"description", "Haut-parleurs MacBook Pro"}}});
  CHECK(parseOutputs(Platform::Darwin, mac) ==
        json::array({{{"id", "auto"}, {"name", "Autoselect device"}, {"exclusiveCapable", true}},
                     {{"id", "coreaudio/BuiltInSpeakerDevice"}, {"name", "Haut-parleurs MacBook Pro"}, {"exclusiveCapable", true}}}));
  json onLinux = json::array({{{"name", "pipewire/alsa_output.usb"}, {"description", "DAC"}},
                            {{"name", "pulse/alsa_output.usb"}, {"description", "DAC"}},
                            {{"name", "alsa/hw:CARD=DAC,DEV=0"}, {"description", "DAC direct"}},
                            {{"name", "alsa/default"}, {"description", "Défaut"}}});
  std::vector<std::string> ids;
  for (const auto& o : parseOutputs(Platform::Linux, onLinux))
    ids.push_back(o["id"].get<std::string>() + ":" + (o["exclusiveCapable"].get<bool>() ? "true" : "false"));
  CHECK((ids == std::vector<std::string>{"auto:true", "pipewire/alsa_output.usb:true", "alsa/hw:CARD=DAC,DEV=0:true", "alsa/default:false"}));
  CHECK(exclusiveCapable(Platform::Win32, "wasapi/{abc}"));
  CHECK(!exclusiveCapable(Platform::Win32, "openal/x"));
  CHECK(parseOutputs(Platform::Win32, json("pas du json")) == json::array({{{"id", "auto"}, {"name", ""}, {"exclusiveCapable", true}}}));
}

static void replayGain() {
  CHECK(effectiveGainMode("auto", "A", {"A", std::nullopt}) == "album");
  CHECK(effectiveGainMode("auto", "A", {"B"}) == "track");
  CHECK(effectiveGainMode("auto", std::nullopt, {"A"}) == "track");
  CHECK(effectiveGainMode("off", "A", {"A"}) == "off");
  ReplayGainValues rg{6, 0.9, -4, 1};
  CHECK_NEAR(*gainFromSource("track", rg), -20 * std::log10(0.9), 1e-6);
  CHECK(*gainFromSource("album", rg) == -4);
  CHECK(*gainFromSource("album", ReplayGainValues{2, std::nullopt, std::nullopt, std::nullopt}) == 2);
  CHECK(*gainFromSource("track", ReplayGainValues{40, std::nullopt, std::nullopt, std::nullopt}) == 12);
  CHECK((replayGainOptions("album", std::nullopt) == Options{{"replaygain", "album"}, {"volume-gain", "0"}}));
  CHECK((replayGainOptions("off", std::nullopt) == Options{{"replaygain", "no"}, {"volume-gain", "0"}}));
  CHECK((replayGainOptions("track", ReplayGainValues{-3, std::nullopt, std::nullopt, std::nullopt}) ==
         Options{{"replaygain", "no"}, {"volume-gain", "-3.00"}}));
}

static void growing() {
  EndContext base{false, 200000, 60000, 0};
  CHECK(!isRealEnd(base));
  CHECK(isRealEnd({false, 200000, 199000, 0}));
  CHECK(isRealEnd({true, 200000, 60000, 0}));
  CHECK(!isRealEnd({false, std::nullopt, 60000, 3}));
  CHECK(isRealEnd({false, std::nullopt, 60000, 4}));
  CHECK(isRealEnd({false, 200000, 60000, 8}));
  CHECK(cachedToEnd(199.8, 0, 200000));
  CHECK(!cachedToEnd(150, 0, 200000));
  CHECK(cachedToEnd(98, 102, 200000));
  CHECK(!cachedToEnd(199.9, 0, std::nullopt));
  CHECK(reloadDelayMs(0) == 250 && reloadDelayMs(1) == 600 && reloadDelayMs(2) == 1200 && reloadDelayMs(3) == 2500 && reloadDelayMs(9) == 2500);
  CHECK(progressed(std::nullopt, 0) && !progressed(1000, 1100) && progressed(1000, 1300));
}

static void codecs() {
  CHECK(contractCodec("dsd_lsbf_planar") == "dsd");
  CHECK(contractCodec("pcm_s24le", "wav") == "wav");
  CHECK(contractCodec("pcm_s16be", "aiff") == "aiff");
  CHECK(contractCodec("mp3float") == "mp3");
  CHECK(!contractCodec("h264"));
  json list = json::array();
  for (const char* c : {"flac", "alac", "opus", "aac", "mp3float", "pcm_s16le", "dsd_lsbf", "h264"}) list.push_back({{"codec", c}});
  CHECK((codecsFromDecoderList(list) == std::vector<std::string>{"aac", "alac", "dsd", "flac", "mp3", "opus", "wav"}));
  AudioFormat announced{"flac", "flac", 96000, 24, std::nullopt, 2, true};
  auto f = decodedFormat({"flac", "flac", 96000, 2, 2400000}, announced);
  AudioFormat expected = announced;
  expected.bitrate = 2400000;
  CHECK(f == expected);
  CHECK(!decodedFormat({}, std::nullopt));
}

static void sources() {
  CHECK(!refuseSource("http://srv:3001/api/music/stream/1", "http://srv:3001"));
  for (const char* bad : {"file:///etc/passwd", "lavfi://sine", "http://ailleurs/x", "http://u:p@srv:3001/x",
                          "https://rr3---sn-nfpnnjvh-1gir.googlevideo.com/videoplayback?expire=1&itag=251",
                          "https://coverartarchive.org/release/x/front", "https://srv:3001/api/music/stream/1", "http://srv:30011/x"})
    CHECK(refuseSource(bad, "http://srv:3001"));
  CHECK(refuseSource("http://srv:3001/x", std::nullopt));
  CHECK(!refuseSource("http://SRV:80/x", "http://srv"));
  std::map<std::string, Source> overrides{{"k", src("lib")}};
  CHECK(servedSource(overrides, "k", src("ext", true, "plugin")).url == "http://s/lib" && overrides.empty());
  std::map<std::string, Source> back{{"k", src("ext", true, "plugin")}};
  CHECK(servedSource(back, "k", src("lib")).url == "http://s/lib");
  Source s = src("x");
  s.expiresAt = 1000 + 30000;
  CHECK(expiresSoon(s, 1000, 60000));
  CHECK(!expiresSoon(src("x"), 1000, 60000));
}

static void sourceRoundTrip() {
  // La source passe au relais de l'axe reseau en JSON et en revient : rien ne se perd.
  Source s = src("x", false, "plugin");
  s.sizeBytes = 1234;
  s.durationMs = 200000;
  s.expiresAt = 1.7e12;
  s.replayGain = ReplayGainValues{-6.5, 0.98, std::nullopt, std::nullopt};
  s.direct = DirectStream{"https://cdn.example/a", 1.8e12};
  s.kept = KeptRef{"u1", std::string("t9")};
  Source back;
  CHECK(!parseSource(toJson(s), back));
  CHECK(back == s);
}

static void level() {
  CHECK(kLevelFilter.rfind(std::string("@") + kLevelLabel + ":lavfi=[astats=", 0) == 0);
  CHECK(kLevelFilter.find("metadata=1") != std::string::npos && kLevelFilter.find("measure_perchannel=none") != std::string::npos);
  CHECK(kLevelProperty == std::string("af-metadata/") + kLevelLabel + "/lavfi.astats.Overall.RMS_level");
  CHECK((levelFilterOption(false) == Options{{"af", kLevelFilter}}) && levelFilterOption(true).empty());
  StartSettings start;
  CHECK(*findOption(startOptions(Platform::Darwin, start, {}), "af") == kLevelFilter);
  start.exclusive = true;
  CHECK(!findOption(startOptions(Platform::Darwin, start, {}), "af"));
  start.exclusive = false;
  CHECK(*findOption(startOptions(Platform::Darwin, start, {{"af", ""}}), "af") == "");  // le banc garde la main
  CHECK_NEAR(*parseLevel("-18.420000"), -18.42, 1e-9);
  CHECK(parseLevel("-inf") == kSilenceDb && parseLevel("-500") == kSilenceDb && parseLevel("3") == 0.0);
  CHECK(!parseLevel(std::nullopt) && !parseLevel("") && !parseLevel("nan"));
  CHECK((warmupArgs() == std::vector<std::string>{"loadfile", "av://lavfi:anullsrc=r=48000:cl=stereo", "replace", "-1", "end=0.05,mute=yes,keep-open=no"}));
}

static QueueEntry entry(Source s) {
  QueueEntry e;
  e.mpvId = 1;
  e.track = track("a", "A");
  e.source = std::move(s);
  return e;
}

static void crossfadeFilter() {
  CHECK(deckChain() == "@xf:lavfi=[asetnsamples=n=256:p=0,volume=volume=1:eval=frame]," + kLevelFilter);
  CHECK(deckChain(fadeInExpr(6)) == "@xf:lavfi=[asetnsamples=n=256:p=0,volume=volume=if(lt(t\\,6.000000)\\,sin(PI/2*max(t\\,0)/6.000000)\\,1):eval=frame]," + kLevelFilter);
  CHECK(fadeOutExpr(34, 6) == "if(lt(t,34.000000),1,if(lt(t,34.000000+6.000000),cos(PI/2*(t-34.000000)/6.000000),0))");
  CHECK((gainCommand("1") == std::vector<std::string>{"af-command", "xf", "volume", "1", "volume"}));
  CHECK(chainFor(true, "1").empty() && chainFor(false, std::nullopt) == kLevelFilter && chainFor(false, "1") == deckChain("1"));
  Source plain = src("a.flac");
  plain.durationMs = 200000;
  CHECK(!findOption(entryOptions(entry(plain), "off"), "af"));
  Source faded = plain;
  faded.fadeInS = 6;
  const auto opts = entryOptions(entry(faded), "off");
  CHECK(*findOption(opts, "af") == deckChain(fadeInExpr(6)));
  CHECK(formatFileOptions(opts).find("af=%") != std::string::npos);
  const auto steps = cutSteps(150);
  CHECK(steps.size() == 15 && std::fabs(steps[0] - 0.989) < 1e-3 && std::fabs(steps.back()) < 1e-12);
  for (size_t i = 1; i < steps.size(); i++) CHECK(steps[i] < steps[i - 1]);
  CHECK(lavfiEscape("if(lt(t,1),0,1)") == "if(lt(t\\,1)\\,0\\,1)");
  CHECK(lavfiEscape("a\\,b") == "a\\\\\\,b");
}

static void crossfadeTiming() {
  auto tl = [](double pos) { return DeckTimeline{pos, 0, 200, true, true, true, false}; };
  CHECK(armDecision(tl(190), 6).kind == ArmDecision::Kind::Wait);
  CHECK((armDecision(tl(192.5), 6) == ArmDecision{ArmDecision::Kind::Arm, 194, 1470}));
  CHECK(armDecision(tl(193.8), 6).kind == ArmDecision::Kind::Late);
  DeckTimeline t = tl(193);
  t.complete = false;
  CHECK(armDecision(t, 6).kind == ArmDecision::Kind::Wait);
  t = tl(193), t.playing = false;
  CHECK(armDecision(t, 6).kind == ArmDecision::Kind::Wait);
  t = tl(193), t.durationS.reset();
  CHECK(armDecision(t, 6).kind == ArmDecision::Kind::Wait);
  t = tl(192.5), t.offsetS = 60;
  CHECK(armDecision(t, 6).kind == ArmDecision::Kind::Arm && armDecision(t, 6).startS == 134);
  Source s = src("a.flac");
  s.durationMs = 200000;
  auto current = std::make_shared<QueueEntry>(entry(s));
  LiveProps props;
  props.timePos = 10;
  props.mpvDuration = 199.37;
  CHECK(deckTimeline(current, props, freshFlags(false), 10).durationS == 199.37);
  props.mpvDuration.reset();
  auto d = deckTimeline(current, props, freshFlags(false), 10);
  CHECK(d.durationS == 200 && d.playing && d.loaded);
  auto loading = deckTimeline(current, LiveProps{}, freshFlags(true), 0);
  CHECK(!loading.playing && !loading.loaded);
  LiveProps m;
  m.mpvDuration = 203.4;
  CHECK(durationOf(current, m) == 203400);
  CHECK(durationOf(current, LiveProps{}) == 200000);
  m.mpvDuration = 0;
  CHECK(durationOf(current, m) == 200000);
  auto partial = std::make_shared<QueueEntry>(entry(src("a", false)));
  partial->source.durationMs = 200000;
  m.mpvDuration = 40;
  CHECK(durationOf(partial, m) == 200000);
}

int main() {
  options();
  outputs();
  replayGain();
  growing();
  codecs();
  sources();
  sourceRoundTrip();
  level();
  crossfadeFilter();
  crossfadeTiming();
  if (failures == 0) std::printf("audio_rules : tous les tests passent\n");
  return failures == 0 ? 0 : 1;
}
