// `validate.test.ts` d'Electron, porté à l'identique (les charges arrivent en JSON, comme
// `JSON.stringify` les fait traverser : NaN et Infinity y deviennent `null`).
#include "glass/tests/check.h"
#include "glass/validate.h"

using namespace tentacle::glass;
using Json = nlohmann::json;

namespace {

const Json good = {{"id", "barre"}, {"x", 24},           {"y", 700},           {"width", 600}, {"height", 56},
                   {"radius", 28},  {"level", "regular"}, {"tint", nullptr}, {"interactive", false}, {"z", 1}};

Json with(Json base, const Json& patch) {
  base.update(patch);
  return base;
}

void parseBatchTests() {
  {  // laisse passer un lot propre, champs facultatifs compris
    const auto parsed = parseBatch({{"enabled", true},
                                    {"upserts",
                                     {good, with(good, {{"id", "pastille"}, {"level", "tinted"}, {"tint", "#7C3AED66"},
                                                        {"group", "lecteur"}, {"spacing", 12}, {"transition", 220}})}},
                                    {"removes", {"ancienne"}}});
    CHECK(parsed && parsed->rejected == 0 && parsed->batch.enabled == true);
    CHECK(parsed && parsed->batch.upserts.size() == 2);
    if (parsed && parsed->batch.upserts.size() == 2) {
      const Region& r = parsed->batch.upserts[1];
      CHECK(r.group == "lecteur" && r.spacing == 12 && r.transition == 220 && r.tint == "#7C3AED66");
    }
    CHECK(parsed && parsed->batch.removes == std::vector<std::string>{"ancienne"});
  }
  {  // écarte une région folle sans perdre les RETRAITS du même lot
    const auto parsed = parseBatch({{"upserts", {with(good, {{"width", nullptr}}), with(good, {{"id", "b"}, {"x", nullptr}}),
                                                 with(good, {{"id", "c"}})}},
                                    {"removes", {"panneau-ferme", 7, ""}}});
    CHECK(parsed && parsed->batch.upserts.size() == 1 && parsed->batch.upserts[0].id == "c");
    CHECK(parsed && parsed->batch.removes == std::vector<std::string>{"panneau-ferme"});
    CHECK(parsed && parsed->rejected == 4);
  }
  {  // refuse ce que AppKit ne saurait pas poser
    const std::vector<Json> bad = {
        with(good, {{"level", "_variant"}}),         with(good, {{"tint", "rgba(0,0,0,.5)"}}),
        with(good, {{"tint", "#FFF"}}),              with(good, {{"width", -1}}),
        with(good, {{"x", 1e9}}),                    with(good, {{"id", std::string(65, 'x')}}),
        with(good, {{"transition", 5000}}),          with(good, {{"interactive", "oui"}}),
    };
    const auto parsed = parseBatch({{"upserts", bad}, {"removes", Json::array()}});
    CHECK(parsed && parsed->batch.upserts.empty() && parsed->rejected == static_cast<int>(bad.size()));
  }
  {  // ne laisse passer aucun champ inconnu jusqu'à AppKit (la région n'a pas de place pour lui)
    const auto parsed = parseBatch({{"upserts", {with(good, {{"selector", "set_" "variant:"}})}}, {"removes", Json::array()}});
    CHECK(parsed && parsed->batch.upserts.size() == 1 && parsed->rejected == 0);
  }
  {  // un lot de forme fausse est rejeté en bloc
    CHECK(!parseBatch(nullptr));
    CHECK(!parseBatch({{"upserts", "a"}}));
    CHECK(!parseBatch({{"upserts", Json::array()}, {"removes", Json::array()}, {"enabled", "oui"}}));
    Json many = Json::array();
    for (int i = 0; i < kMaxRegions * 4 + 1; ++i) many.push_back(good);
    CHECK(!parseBatch({{"upserts", many}, {"removes", Json::array()}}));
  }
  {  // en plus (JSON) : `null` pour un facultatif est refusé comme par zod ; l'UTF-16 compte
    CHECK(parseBatch({{"upserts", {with(good, {{"group", nullptr}})}}, {"removes", Json::array()}})->rejected == 1);
    CHECK(utf16Length("é") == 1 && utf16Length("😀") == 2);
    std::string emoji;
    for (int i = 0; i < 33; ++i) emoji += "😀";  // 66 unités UTF-16 : trop long pour zod
    CHECK(parseBatch({{"upserts", Json::array()}, {"removes", {emoji}}})->rejected == 1);
  }
}

void parseSampleRectsTests() {
  {  // garde des rectangles propres, refuse une forme fausse ou démesurée
    const auto ok = parseSampleRects(Json::array({{{"x", 0}, {"y", 0}, {"width", 120}, {"height", 40}}}));
    CHECK(ok && ok->size() == 1 && (*ok)[0].width == 120 && !(*ok)[0].underWindow);
    CHECK(!parseSampleRects(Json::array({{{"x", 0}, {"y", 0}, {"width", -1}, {"height", 40}}})));
    CHECK(!parseSampleRects(Json::array({{{"x", nullptr}, {"y", 0}, {"width", 1}, {"height", 1}}})));
    CHECK(!parseSampleRects("tout"));
    Json many = Json::array();
    for (int i = 0; i < 33; ++i) many.push_back({{"x", 0}, {"y", 0}, {"width", 1}, {"height", 1}});
    CHECK(!parseSampleRects(many));
  }
  {  // garde `under: "window"`, refuse toute autre valeur
    const auto under = parseSampleRects(Json::array({{{"x", 0}, {"y", 0}, {"width", 120}, {"height", 40}, {"under", "window"}}}));
    CHECK(under && (*under)[0].underWindow);
    CHECK(!parseSampleRects(Json::array({{{"x", 0}, {"y", 0}, {"width", 120}, {"height", 40}, {"under", "page"}}})));
    CHECK(parseSampleRects(Json::array({{{"x", 0}, {"y", 0}, {"width", 120}, {"height", 40}, {"under", "window"}, {"selector", "x"}}})));
  }
}

}  // namespace

void runValidateTests() {
  parseBatchTests();
  parseSampleRectsTests();
}
