// Transition douce du bureau — port de `crossfadeDecks.test.ts` d'Electron : de fausses
// instances notent ce qu'on leur demande, leur chronologie se règle à la main, le temps est virtuel.
#include <memory>
#include <string>
#include <vector>

#include "music/crossfade_decks.h"
#include "music/tests/test_kit.h"

using namespace tentacle::music;
using namespace tentacle::music::testing;
using json = nlohmann::json;

namespace {

struct Call {
  std::string name;
  std::optional<Track> track;
  std::optional<Source> source;
  double number = 0;
  bool flag = false;
  std::string text;
  Control control;
};

class FakeDeck final : public Deck {
 public:
  explicit FakeDeck(DeckEmit emit) : emit(std::move(emit)) {}
  std::vector<Call> calls;
  DeckTimeline tl{0, 0, 200, true, false, false, false};
  DeckEmit emit;

  void start(const StartSettings&, StartDone done) override { done(std::nullopt, json::object()); }
  void play(const Track& t, const Source& s, double startMs, bool paused) override { calls.push_back({"play", t, s, startMs, paused}); }
  void setNext(const std::optional<Track>& t, const std::optional<Source>& s) override { calls.push_back({"setNext", t, s}); }
  void swap(const std::string& key, const Source& s) override { calls.push_back({"swap", std::nullopt, s, 0, false, key}); }
  void control(const Control& c) override { calls.push_back({"control", {}, {}, 0, false, c.action, c}); }
  void listOutputs(std::function<void(json)> done) override { done(json::array()); }
  void setOutput(const std::optional<std::string>&, bool, Done done) override {
    calls.push_back({"setOutput"});
    done(std::nullopt);
  }
  void setChain(const std::optional<std::string>& e) override { calls.push_back({"setChain", {}, {}, 0, false, e.value_or("null")}); }
  void setGain(const std::string& e) override { calls.push_back({"setGain", {}, {}, 0, false, e}); }
  DeckTimeline timeline() const override { return tl; }
  void sourceCut(const std::string&) override {}
  void level(std::function<void(std::optional<double>)> done) override { done(std::nullopt); }
  void readProperty(const std::string&, std::function<void(json)> done) override { done(nullptr); }
  void dispose(std::function<void()> done) override {
    calls.push_back({"dispose"});
    done();
  }

  std::vector<Call> named(const std::string& n) const {
    std::vector<Call> out;
    for (const auto& c : calls)
      if (c.name == n) out.push_back(c);
    return out;
  }
  std::vector<std::string> controls() const {
    std::vector<std::string> out;
    for (const auto& c : named("control")) out.push_back(c.text);
    return out;
  }
  void state(const std::string& key, const std::string& status = "playing") {
    emit({{"type", "state"}, {"at", 0}, {"state", {{"status", status}, {"trackKey", key}, {"positionMs", 0}}}});
  }
};

Source source(const std::string& key) {
  Source s = src(key);
  s.durationMs = 200000;
  return s;
}

struct Rig {
  FakeScheduler scheduler;
  std::vector<FakeDeck*> made;
  std::vector<json> events;
  std::unique_ptr<CrossfadeDecks> decks;
  explicit Rig(double crossfadeMs = 6000) {
    decks = std::make_unique<CrossfadeDecks>(
        scheduler,
        [this](DeckEmit emit) {
          auto d = std::make_unique<FakeDeck>(std::move(emit));
          made.push_back(d.get());
          return d;
        },
        [this](const json& e) { events.push_back(e); });
    StartSettings start;
    start.serverOrigin = "http://s";
    start.replayGain = "off";
    decks->start(start, [](std::optional<std::string>, json) {});
    decks->control(Control::of("crossfade", crossfadeMs));
    scheduler.flush();
  }
  FakeDeck* a() { return made.at(0); }
  FakeDeck* b() { return made.size() > 1 ? made[1] : nullptr; }
  size_t count(const std::string& type) const {
    size_t n = 0;
    for (const auto& e : events) n += e.value("type", "") == type;
    return n;
  }
  // A joue t1 ; t2 est donné à fondre ; A arrive près de sa fin, B est chargé.
  void nearEnd() {
    decks->play(track("t1"), source("t1"), 0);
    a()->tl.playing = a()->tl.loaded = true;
    a()->tl.positionS = 10;
    decks->setNext(track("t2"), source("t2"), 6000);
    b()->tl.loaded = true;
    a()->tl.positionS = 192.5;
    a()->state("t1");
  }
};

void off() {
  Rig r(0);
  CHECK(r.made.size() == 1);
  r.decks->setNext(track("t2"), source("t2"), 6000);
  auto next = r.a()->named("setNext");
  CHECK(next.size() == 1 && next[0].track == track("t2") && next[0].source == source("t2"));
}

void preparesPaused() {
  Rig r;
  r.nearEnd();
  auto chain = r.b()->named("setChain");
  CHECK(chain.size() == 1 && chain[0].text == "1");
  CHECK(!r.a()->named("setNext").back().track);
  auto play = r.b()->named("play");
  CHECK(play.size() == 1 && play[0].track->trackKey == "t2" && play[0].source->fadeInS == 6 && play[0].number == 0 && play[0].flag);
}

void fadeRuns() {
  Rig r;
  r.nearEnd();
  CHECK(r.a()->named("setGain").back().text.find("cos(PI/2*(t-194.000000)/6.000000)") != std::string::npos);
  auto resumes = [&] {
    size_t n = 0;
    for (const auto& c : r.b()->controls()) n += c == "resume";
    return n;
  };
  r.scheduler.advance(1469);
  CHECK(resumes() == 0);
  r.scheduler.advance(1);
  CHECK(resumes() == 1);
  r.scheduler.advance(2999);
  CHECK(r.count("advanced") == 0);
  r.b()->state("t2");
  CHECK(r.count("state") == 1);  // la réserve se tait avant la mi-fondu
  r.scheduler.advance(1);
  CHECK(r.count("advanced") == 1);
  CHECK(r.events.back() == json({{"type", "advanced"}, {"fromKey", "t1"}, {"toKey", "t2"}}));
  const size_t before = r.events.size();
  r.a()->state("t1");
  r.b()->state("t2");
  CHECK(r.events.size() == before + 1 && r.events.back()["state"]["trackKey"] == "t2");
  r.scheduler.advance(3500);
  CHECK(r.a()->controls().back() == "stop");
}

void pauseFreezes() {
  Rig r;
  r.nearEnd();
  r.scheduler.advance(1470 + 1000);
  r.decks->control(Control::of("pause"));
  CHECK(r.b()->controls().back() == "pause");
  r.scheduler.advance(10000);
  CHECK(r.count("advanced") == 0);
  r.decks->control(Control::of("resume"));
  r.scheduler.advance(2000);
  CHECK(r.count("advanced") == 1);
}

void sameAlbum() {
  Rig r;
  r.decks->play(track("t1"), source("t1"), 0);
  r.decks->setNext(track("t2"), source("t2"), 0);
  CHECK(r.a()->named("setNext").back().track == track("t2"));
  CHECK(r.b()->named("play").empty());
}

void switchedOnMidListen() {
  Rig r(0);
  r.decks->play(track("t1"), source("t1"), 0);
  r.decks->control(Control::of("crossfade", 6000));
  r.scheduler.flush();
  r.decks->setNext(track("t2"), source("t2"), 6000);
  CHECK(r.a()->named("setNext").back().track == track("t2"));
  r.decks->play(track("t3"), source("t3"), 0);
  r.decks->setNext(track("t4"), source("t4"), 6000);
  CHECK(r.made.at(1)->named("play").back().track == track("t4"));
}

void tooLate() {
  Rig r;
  r.decks->play(track("t1"), source("t1"), 0);
  r.decks->setNext(track("t2"), source("t2"), 6000);
  r.b()->tl.loaded = true;
  r.a()->tl.playing = r.a()->tl.loaded = true;
  r.a()->tl.positionS = 193.9;
  r.a()->state("t1");
  CHECK(r.a()->named("setNext").back().track == track("t2"));
  CHECK(r.b()->controls().back() == "stop");
}

void gesture() {
  Rig r;
  r.decks->play(track("t1"), source("t1"), 0);
  r.a()->tl.playing = r.a()->tl.loaded = true;
  r.decks->play(track("t3"), source("t3"), 0);
  CHECK(r.b()->named("play").back().track == track("t3"));
  r.scheduler.advance(160);
  auto gains = r.a()->named("setGain");
  CHECK(gains.size() == 15 && std::stod(gains.back().text) == 0);
  r.scheduler.advance(500);
  CHECK(r.a()->controls().back() == "stop");
}

void nextAfterGesture() {
  Rig r;
  r.decks->play(track("t1"), source("t1"), 0);
  r.a()->tl.playing = r.a()->tl.loaded = true;
  r.decks->play(track("t3"), source("t3"), 0);
  r.decks->setNext(track("t4"), source("t4"), 6000);
  CHECK(r.a()->named("play").size() == 1);
  r.scheduler.advance(160);
  CHECK(std::stod(r.a()->named("setGain").back().text) == 0 && r.a()->named("play").size() == 1);
  r.scheduler.advance(500);
  CHECK(r.a()->controls().back() == "stop");
  auto last = r.a()->named("play").back();
  CHECK(last.track->trackKey == "t4" && last.source->fadeInS == 6 && last.flag);
}

void seekInFadeIn() {
  Rig r;
  r.nearEnd();
  r.scheduler.advance(1470 + 3000 + 3500);
  r.decks->control(Control::of("seek", 2000));
  auto replay = r.b()->named("play").back();
  CHECK(replay.track->trackKey == "t2" && !replay.source->fadeInS && replay.number == 2000);
  r.decks->control(Control::of("seek", 30000));
  CHECK(r.b()->controls().back() == "seek" && r.b()->named("control").back().control.value == 30000);
}

void swapWaits() {
  Rig r;
  r.nearEnd();
  r.scheduler.advance(1470 + 1000);
  r.decks->swap("t2", source("t2-lib"));
  CHECK(r.b()->named("swap").empty());
  r.scheduler.advance(5500);
  auto swaps = r.b()->named("swap");
  CHECK(swaps.size() == 1 && swaps[0].text == "t2" && swaps[0].source == source("t2-lib"));
}

void exclusive() {
  Rig r;
  r.decks->setOutput(std::nullopt, true, [](std::optional<std::string>) {});
  CHECK(r.b()->named("dispose").size() == 1);  // avant la vidange : l'instance part ensuite
  r.decks->setNext(track("t2"), source("t2"), 6000);
  CHECK(r.a()->named("setNext").back().track == track("t2"));
}

}  // namespace

int main() {
  off();
  preparesPaused();
  fadeRuns();
  pauseFreezes();
  sameAlbum();
  switchedOnMidListen();
  tooLate();
  gesture();
  nextAfterGesture();
  seekInFadeIn();
  swapWaits();
  exclusive();
  if (failures == 0) std::printf("crossfade_decks : tous les tests passent\n");
  return failures == 0 ? 0 : 1;
}
