// Portage de `playbackFarewell.test.ts` : la lecture ouverte est suivie d'un report à l'autre,
// la position extrapolée ne s'emballe pas, et la sortie n'attend jamais plus que son échéance
// — ni n'échoue.

#include <nlohmann/json.hpp>

#include <functional>
#include <stdexcept>
#include <vector>

#include "lifecycle/playback_farewell.h"
#include "tests/check.h"

using namespace tentacle::lifecycle;
using Json = nlohmann::json;

namespace {

constexpr int64_t kTicksPerSecond = 10'000'000;

SessionPost post(const std::string& path, const Json& body) {
  return {"https://jf.example", path, "jeton", "MediaBrowser Client=\"Tentacle TV\"", body.dump()};
}

SessionPost start(const std::string& playSessionId = "ps1", int64_t positionSeconds = 60) {
  return post("/Sessions/Playing", {{"ItemId", "item1"},
                                    {"MediaSourceId", "ms1"},
                                    {"PlaySessionId", playSessionId},
                                    {"PositionTicks", positionSeconds * kTicksPerSecond},
                                    {"IsPaused", false}});
}

Json bodyOf(const std::vector<FarewellStop>& stops, size_t i = 0) {
  return i < stops.size() ? Json::parse(stops[i].body) : Json();
}

// Un minuteur manuel : `fire()` déclenche l'échéance.
struct ManualTimer {
  std::vector<std::function<void()>> pending;
  PlaybackFarewell::After after() {
    return [this](int64_t, std::function<void()> fn) { pending.push_back(std::move(fn)); };
  }
  void fire() {
    auto all = std::move(pending);
    for (auto& fn : all) fn();
  }
};

void tracking() {
  CASE("un début ouvre la lecture, un arrêt la referme");
  {
    PlaybackFarewell f([] { return 0; });
    f.note(start());
    CHECK(f.pending());
    f.note(post("/Sessions/Playing/Stopped", {{"ItemId", "item1"}, {"PlaySessionId", "ps1"}}));
    CHECK(!f.pending());
  }
  CASE("un arrêt sans session de lecture ferme tout ce qui porte le média");
  {
    PlaybackFarewell f([] { return 0; });
    f.note(start("ps1"));
    f.note(post("/Sessions/Playing/Stopped", {{"ItemId", "item1"}}));
    CHECK(!f.pending());
  }
  CASE("une progression d'une lecture inconnue l'ouvre");
  {
    PlaybackFarewell f([] { return 0; });
    f.note(post("/Sessions/Playing/Progress", {{"ItemId", "item2"}, {"PositionTicks", 5}, {"IsPaused", true}}));
    CHECK(bodyOf(f.stops()) == Json({{"ItemId", "item2"}, {"MediaSourceId", "item2"}, {"PositionTicks", 5}}));
    // L'ordre des clés est celui de JSON.stringify.
    CHECK(f.stops()[0].body == R"({"ItemId":"item2","MediaSourceId":"item2","PositionTicks":5})");
  }
  CASE("un corps illisible ou sans média ne touche à rien");
  {
    PlaybackFarewell f([] { return 0; });
    SessionPost broken = post("/Sessions/Playing", {});
    broken.body = "{pas du json";
    f.note(broken);
    f.note(post("/Sessions/Playing", {{"PositionTicks", 12}}));
    CHECK(!f.pending());
  }
  CASE("la progression garde la route, le jeton et la source déjà connus");
  {
    PlaybackFarewell f([] { return 0; });
    f.note(start());
    f.note(post("/Sessions/Playing/Progress", {{"ItemId", "item1"}, {"PlaySessionId", "ps1"}, {"PositionTicks", 7}}));
    const auto stops = f.stops();
    CHECK(stops.size() == 1 && stops[0].baseUrl == "https://jf.example" && stops[0].token == "jeton");
    CHECK(bodyOf(stops)["MediaSourceId"] == "ms1" && bodyOf(stops)["PlaySessionId"] == "ps1");
  }
}

void position() {
  CASE("extrapole depuis le dernier report quand la lecture tourne");
  {
    int64_t now = 1'000;
    PlaybackFarewell f([&] { return now; });
    f.note(start("ps1", 60));
    now += 8'000;
    CHECK(bodyOf(f.stops())["PositionTicks"] == 68 * kTicksPerSecond);
  }
  CASE("n'extrapole pas en pause");
  {
    int64_t now = 0;
    PlaybackFarewell f([&] { return now; });
    f.note(post("/Sessions/Playing/Progress", {{"ItemId", "item1"}, {"PositionTicks", 42}, {"IsPaused", true}}));
    now += 20'000;
    CHECK(bodyOf(f.stops())["PositionTicks"] == 42);
  }
  CASE("plafonne l'extrapolation : une page muette ne fait pas avancer le film");
  {
    int64_t now = 0;
    PlaybackFarewell f([&] { return now; });
    f.note(start("ps1", 0));
    now += 60 * 60'000;
    CHECK(bodyOf(f.stops())["PositionTicks"] == kMaxExtrapolationMs * 10'000);
  }
}

void leaving() {
  CASE("poste l'arrêt de ce qui reste ouvert, puis n'a plus rien à dire");
  {
    PlaybackFarewell f([] { return 0; });
    f.note(start());
    std::vector<FarewellStop> sent;
    ManualTimer timer;
    bool done = false;
    f.farewell([&](const FarewellStop& s, std::function<void()> d) { sent.push_back(s); d(); }, 1'500,
               timer.after(), [&] { done = true; });
    CHECK(done && sent.size() == 1);
    CHECK(bodyOf(sent)["ItemId"] == "item1" && bodyOf(sent)["PlaySessionId"] == "ps1");
    CHECK(!f.pending());
  }
  CASE("attend l'envoi en vol que la page vient de confier au relais");
  {
    PlaybackFarewell f([] { return 0; });
    const uint64_t inFlight = f.track();
    CHECK(f.pending());
    ManualTimer timer;
    bool done = false;
    f.farewell([](const FarewellStop&, std::function<void()> d) { d(); }, 10'000, timer.after(), [&] { done = true; });
    CHECK(!done);
    f.release(inFlight);
    CHECK(done);
    CHECK(!f.pending());
  }
  CASE("n'attend jamais plus que l'échéance");
  {
    PlaybackFarewell f([] { return 0; });
    f.note(start());
    ManualTimer timer;
    int done = 0;
    f.farewell([](const FarewellStop&, std::function<void()>) {}, 1'500, timer.after(), [&] { done++; });
    CHECK(done == 0);
    timer.fire();
    CHECK(done == 1);
  }
  CASE("ne rejette pas quand l'envoi échoue ou lève");
  {
    PlaybackFarewell f([] { return 0; });
    f.note(start("ps1"));
    f.note(start("ps2"));
    int calls = 0, done = 0;
    ManualTimer timer;
    f.farewell(
        [&](const FarewellStop& s, std::function<void()> d) {
          calls++;
          if (Json::parse(s.body)["PlaySessionId"] == "ps1") throw std::runtime_error("réseau");
          d();  // un 503 : l'envoi a fini, en échec
        },
        1'500, timer.after(), [&] { done++; });
    CHECK(calls == 2 && done == 1);
    timer.fire();
    CHECK(done == 1);  // une seule fois, même quand l'échéance tombe après
  }
}

}  // namespace

void runPlaybackFarewellTests() {
  tracking();
  position();
  leaving();
}
