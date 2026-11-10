// Portage de `reconcile.test.ts` (`applyServerUserData`) : le bureau tire l'état de lecture
// du serveur — une série vue ailleurs ne repart plus à l'épisode 1.

#include "offline/core/args.h"
#include "offline/core/listing.h"
#include "offline/core/playback.h"
#include "offline/core/reconcile.h"
#include "tests/testkit.h"

using namespace offline_tests;

namespace {

constexpr int64_t kNow = 2000000;
const std::set<std::string> kNone;

struct Local {
  int64_t position;
  bool played;
  int64_t updatedAt;
};

std::optional<Local> local(Database& db, const std::string& itemId = "item1") {
  const auto row = db.prepare("SELECT position_ticks, played, updated_at FROM playback_state WHERE item_id = ?").get(itemId);
  if (!row) return std::nullopt;
  return Local{integer(*row, "position_ticks"), flag(*row, "played"), integer(*row, "updated_at")};
}

ServerUserData server(const std::string& itemId, bool played, int64_t position, std::optional<int64_t> date) {
  return ServerUserData{itemId, played, position, date};
}

}  // namespace

TEST(rapprochement_etat_serveur_plus_recent) {
  auto db = openMemoryDatabase();
  setPlaybackState(*db, "u", "item1", 100, false, false, 1000);
  const auto changed = applyServerUserData(*db, "u", {server("item1", false, 900, 5000)}, kNow, kNone);
  CHECK(changed.size() == 1 && changed[0] == "item1");
  const auto state = local(*db);
  CHECK(state && state->position == 900 && !state->played && state->updatedAt == 5000);
}

TEST(rapprochement_ignore_plus_ancien_ou_sans_date) {
  auto db = openMemoryDatabase();
  setPlaybackState(*db, "u", "item1", 100, false, false, 9000);
  CHECK(applyServerUserData(*db, "u", {server("item1", true, 0, 5000)}, kNow, kNone).empty());
  CHECK(applyServerUserData(*db, "u", {server("item1", false, 300, std::nullopt)}, kNow, kNone).empty());
  CHECK(applyServerUserData(*db, "u", {server("item1", true, 0, std::nullopt)}, kNow, kNone).empty());
  const auto state = local(*db);
  CHECK(state && state->position == 100 && !state->played && state->updatedAt == 9000);
}

TEST(rapprochement_titre_vu_ailleurs) {
  auto db = openMemoryDatabase();
  CHECK(applyServerUserData(*db, "u", {server("vide", false, 0, std::nullopt)}, kNow, kNone).empty());
  CHECK(!local(*db, "vide"));
  CHECK(applyServerUserData(*db, "u", {server("vu", true, 0, 7000)}, kNow, kNone).size() == 1);
  const auto seen = local(*db, "vu");
  CHECK(seen && seen->position == 0 && seen->played && seen->updatedAt == 7000);
  // « Vu » sans date : retenu, l'appareil n'en savait rien.
  CHECK(applyServerUserData(*db, "u", {server("importe", true, 0, std::nullopt)}, kNow, kNone).size() == 1);
  const auto imported = local(*db, "importe");
  CHECK(imported && imported->played && imported->updatedAt == kNow);
}

TEST(rapprochement_marquer_non_vu) {
  auto db = openMemoryDatabase();
  setPlaybackState(*db, "u", "item1", 0, true, false, 1000);
  const auto unmarked = server("item1", false, 0, std::nullopt);
  CHECK(applyServerUserData(*db, "u", {unmarked}, kNow, {"item1"}).empty());
  CHECK(local(*db)->played);
  CHECK(applyServerUserData(*db, "u", {unmarked}, kNow, kNone).size() == 1);
  const auto state = local(*db);
  CHECK(state && state->position == 0 && !state->played && state->updatedAt == kNow);
}

TEST(rapprochement_auto_suppression) {
  auto db = openMemoryDatabase();
  ClaimSpec s = spec();
  s.autoDeleteAfterWatch = true;
  const int64_t fileId = claimOrCreateFile(*db, s).fileId;
  setAutoDelete(*db, "u", fileId, true, 30, 1000);
  const auto deadline = [&] {
    return integerOrNull(*db->prepare("SELECT delete_scheduled_at FROM claims WHERE file_id = ?").get(fileId),
                         "delete_scheduled_at");
  };
  applyServerUserData(*db, "u", {server("item1", true, 0, 5000)}, kNow, kNone);
  CHECK(deadline() == kNow / 1000 + 30 * 60);
  applyServerUserData(*db, "u", {server("item1", false, 0, std::nullopt)}, kNow + 1, kNone);
  CHECK(!deadline());
  CHECK(!local(*db)->played);
}

TEST(rapprochement_ni_autre_compte_ni_file) {
  auto db = openMemoryDatabase();
  setPlaybackState(*db, "autre", "item1", 50, false, false, 1000);
  applyServerUserData(*db, "u", {server("item1", true, 0, 5000)}, kNow, kNone);
  CHECK(integer(*db->prepare("SELECT played FROM playback_state WHERE jellyfin_user_id = 'autre'").get(), "played") == 0);
  CHECK(integer(*db->prepare("SELECT COUNT(*) AS n FROM report_queue").get(), "n") == 0);
}

TEST(rapprochement_charge_de_la_page) {
  const Json entries = Json::parse(
      R"([{"itemId":"a","played":true,"positionTicks":0,"lastPlayedAtMs":1794300000000},
          {"itemId":"b","played":false,"positionTicks":1234.9,"lastPlayedAtMs":null}])");
  const auto parsed = parseServerUserData(entries);
  CHECK(parsed.size() == 2 && parsed[0].itemId == "a" && parsed[0].played && parsed[0].lastPlayedAtMs == 1794300000000);
  CHECK(parsed[1].positionTicks == 1234 && !parsed[1].lastPlayedAtMs);
  CHECK(parseItemIds(Json::parse(R"(["a","b","a"])")).size() == 2);
  CHECK_THROWS(parseServerUserData(Json::parse(R"({"itemId":"a"})")));
  CHECK_THROWS(parseServerUserData(Json::parse(R"([{"itemId":"","played":true,"positionTicks":0,"lastPlayedAtMs":null}])")));
  CHECK_THROWS(parseServerUserData(Json::parse(R"([{"itemId":"a","played":true,"positionTicks":0}])")));
  CHECK_THROWS(parseServerUserData(Json::parse(R"([{"itemId":"a","played":true,"positionTicks":-1,"lastPlayedAtMs":null}])")));
  CHECK_THROWS(parseItemIds(Json::parse(R"([""])")));
}
