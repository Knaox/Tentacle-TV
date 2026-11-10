// Portage de `playback.test.ts`, `purge.test.ts`, `enqueue.test.ts` et `musicKeep.test.ts`
// (hors transfert, porté avec le moteur).

#include "offline/core/enqueue.h"
#include "offline/core/listing.h"
#include "offline/core/meta.h"
#include "offline/core/music.h"
#include "offline/core/playback.h"
#include "offline/core/queue.h"
#include "offline/core/local_assets.h"
#include "tests/testkit.h"

using namespace offline_tests;

namespace {

int64_t seedComplete(Database& db, int64_t size) {
  ClaimSpec s = spec();
  s.expectedSize = size;
  const int64_t id = claimOrCreateFile(db, s).fileId;
  db.prepare("UPDATE files SET status = 'complete' WHERE id = ?").run(id);
  return id;
}

EnqueueItem film(const std::string& itemId = "item1", int64_t expected = kGiB) {
  EnqueueItem it;
  it.itemId = itemId;
  it.mediaSourceId = "ms1";
  it.variant = "original";
  it.containerExt = "mkv";
  it.expectedSize = expected;
  it.kind = "movie";
  it.title = "Un film";
  return it;
}

const std::string kJf = "0123456789abcdef0123456789abcdef";

music::KeepItem track() {
  music::KeepItem t;
  t.trackKey = "jf:" + kJf;
  t.origin = "library";
  t.sourcePath = "/api/downloads/original/" + kJf + "?mediaSourceId=" + kJf;
  t.variant = "original";
  t.containerExt = "flac";
  t.expectedSize = 3;
  t.title = "Atlantean Twilight";
  t.artist = "Elegant Piano";
  t.album = "Piano";
  t.albumKey = "jf:album1";
  t.discNumber = 1;
  t.trackNumber = 2;
  t.durationMs = 20000;
  t.artworkPath = "/api/music/artwork/" + kJf;
  t.trackJson = R"({"key":"jf:)" + kJf + R"(","title":"Atlantean Twilight"})";
  return t;
}

music::KeepItem external() {
  music::KeepItem t = track();
  t.trackKey = "ext:sillon:ytm:t:dQw4w9WgXcQ";
  t.origin = "external";
  t.sourcePath = "/api/plugins/sillon/music/offline/ytm%3At%3AdQw4w9WgXcQ";
  t.containerExt = "audio";
  t.expectedSize.reset();
  t.estimatedSize = 5000000;
  t.artworkPath.reset();
  return t;
}

}  // namespace

TEST(lecture_source_locale) {
  Root root;
  auto db = openMemoryDatabase();
  writeMedia(root, "media/item1/original-ms1.mkv", "1234");
  writeMedia(root, "media/item1/subs/3-fre.srt");
  writeMedia(root, "media/item1/subs/1-eng.srt");
  const int64_t fileId = seedComplete(*db, 4);
  setPlaybackState(*db, "u", "item1", 5000, false, false, 2000);
  Json source = localSource(*db, root.volume, "u", "item1", 3000);
  CHECK(source["absolutePath"] == pathToUtf8(root.at("media/item1/original-ms1.mkv").lexically_normal()));
  CHECK(source["positionTicks"] == 5000 && source["played"] == false && source["fileId"] == fileId);
  CHECK(source["subtitleFiles"].size() == 2 && source["subtitleFiles"][0]["fileName"] == "1-eng.srt");
  CHECK(localSource(*db, root.volume, "autre", "item1", 3000).is_null());
  writeMedia(root, "media/item1/original-ms1.mkv", "12");  // tronqué hors de l'application
  CHECK(localSource(*db, root.volume, "u", "item1", 3000).is_null());
  CHECK(getFile(*db, fileId)->errorCode == std::optional<std::string>("integrity"));
}

TEST(lecture_fichier_disparu_et_allege) {
  Root root;
  auto db = openMemoryDatabase();
  const int64_t fileId = seedComplete(*db, 4);
  CHECK(localSource(*db, root.volume, "u", "item1", 3000).is_null());
  CHECK(getFile(*db, fileId)->errorCode == std::optional<std::string>("missing"));
  auto db2 = openMemoryDatabase();
  ClaimSpec light = lightSpec();
  light.expectedSize = 999;
  const int64_t lightId = claimOrCreateFile(*db2, light).fileId;
  db2->prepare("UPDATE files SET status = 'complete' WHERE id = ?").run(lightId);
  writeMedia(root, "media/item1/light-ms1-p720.mp4", "court");
  upsertItemMeta(*db2, {"item1", "episode", "s", "ss", "lib-1", 100, "Ep", "Une serie", 4, 2}, 1);
  const Json source = localSource(*db2, root.volume, "u", "item1", 3000);
  CHECK(!source.is_null() && source["seriesName"] == "Une serie" && source["indexNumber"] == 4);
  CHECK(source["parentIndexNumber"] == 2 && source["libraryId"] == "lib-1" && source["variant"] == "light");
  CHECK(source["seriesId"] == "s");  // la préférence de pistes de la série, sans DTO serveur
}

TEST(lecture_progression_et_file) {
  auto db = openMemoryDatabase();
  setPlaybackState(*db, "u", "item1", 1000, true, true, 1);
  setPlaybackState(*db, "u", "item1", 9000, false, true, 2);  // « vu » ne redescend jamais
  CHECK(integer(*db->prepare("SELECT played FROM playback_state").get(), "played") == 1);
  setPlaybackState(*db, "u", "item2", 10, false, true, 3);
  setPlaybackState(*db, "autre", "item1", 10, false, true, 4);
  setPlaybackState(*db, "u", "item3", 10, false, false, 5);  // en ligne : pas de file
  Json pending = pendingReports(*db, "u");
  CHECK(pending.size() == 2 && pending[0]["itemId"] == "item1" && pending[0]["positionTicks"] == 9000);
  CHECK(pending[0]["played"] == false);  // le rapport le plus récent fait foi
  markItemSynced(*db, "u", "item1", pending[0]["id"].get<int64_t>());
  pending = pendingReports(*db, "u");
  CHECK(pending.size() == 1 && pending[0]["itemId"] == "item2");
  CHECK(pendingReports(*db, "autre").size() == 1);
  // Recommencer : progression à neuf, échéance levée, rien en file.
  restartPlayback(*db, "u", "item1", 5000);
  const auto state = db->prepare("SELECT position_ticks, played, updated_at FROM playback_state WHERE jellyfin_user_id='u' AND item_id='item1'").get();
  CHECK(integer(*state, "position_ticks") == 0 && integer(*state, "played") == 0 && integer(*state, "updated_at") == 5000);
  CHECK(pendingReports(*db, "u").size() == 1);
}

TEST(purge_des_vus) {
  Root root;
  auto db = openMemoryDatabase();
  writeMedia(root, "media/item1/original-ms1.mkv");
  const int64_t fileId = claimOrCreateFile(*db, spec()).fileId;
  setAutoDelete(*db, "u", fileId, true, 30, 1000000);
  setPlaybackState(*db, "u", "item1", 0, true, false, 1000000);
  scheduleOnPlayed(*db, "u", "item1", 1000000);
  scheduleOnPlayed(*db, "u", "item1", 9000000);  // jamais repoussée
  CHECK(integer(*db->prepare("SELECT delete_scheduled_at AS a FROM claims").get(), "a") == 1000 + 30 * 60);
  CHECK(purgeDueClaims(*db, root.volume, 1000000 + 60000, std::nullopt) == 0);  // pas échue
  const int64_t due = (1000 + 30 * 60) * 1000LL;
  setPlaybackState(*db, "u", "item1", 0, true, false, due - 10000);  // battement frais
  CHECK(purgeDueClaims(*db, root.volume, due, std::nullopt) == 0);
  CHECK(purgeDueClaims(*db, root.volume, due + 120000, std::nullopt, std::string("item1")) == 0);  // en lecture
  CHECK(purgeDueClaims(*db, root.volume, due, std::string("item1")) == 1);
  CHECK(countRows(*db, "claims") == 0 && !fs::exists(root.at("media/item1/original-ms1.mkv")));
}

TEST(mise_en_file_lots) {
  auto db = openMemoryDatabase();
  CHECK_THROWS(enqueueBatch(*db, "u", {}, 100 * kGiB, 1));
  EnqueueItem bad = film("../evil");
  CHECK_THROWS(enqueueBatch(*db, "u", {film(), bad}, 100 * kGiB, 1));
  CHECK(countRows(*db, "files") == 0);
  CHECK(mediaRelPath(film()) == "media/item1/original-ms1.mkv");
  EnqueueItem light = film();
  light.variant = "light";
  CHECK(mediaRelPath(light) == "media/item1/light-ms1-p720.mp4");
  light.preset = "p1080";
  CHECK(mediaRelPath(light) == "media/item1/light-ms1-p1080.mp4");
  Json refused = enqueueBatch(*db, "u", {film("item1", 4 * kGiB), film("item2", 2 * kGiB)}, 7 * kGiB, 1);
  CHECK(refused["accepted"] == false && refused["neededBytes"] == 6 * kGiB && refused["fileIds"].empty());
  Json ok = enqueueBatch(*db, "u", {film()}, 4 * kGiB, 1);
  CHECK(ok["accepted"] == true && ok["fileIds"].size() == 1);
  // Un fichier déjà là ne compte pas deux fois ; les promesses en cours, si.
  CHECK(enqueueBatch(*db, "u", {film()}, 3 * kGiB + 1, 2)["neededBytes"] == kGiB);
}

TEST(mise_en_file_allege_et_meta) {
  auto db = openMemoryDatabase();
  EnqueueItem ep = film("ep1");
  ep.variant = "light";
  ep.preset = "p720";
  ep.expectedSize.reset();
  ep.estimatedSize = 2 * kGiB;
  ep.kind = "episode";
  ep.seriesId = "serie1";
  ep.seasonId = "saison1";
  ep.seriesName = "Une serie";
  ep.indexNumber = 4;
  ep.parentIndexNumber = 2;
  ep.audioStreamIndex = 3;
  ep.burnSubtitleIndex = 5;
  ep.subtitles = std::vector<SubtitleSpec>{{7, "srt", "fre"}};
  ep.autoDeleteAfterWatch = true;
  ep.autoDeleteDelayMinutes = 15;
  const Json outcome = enqueueBatch(*db, "u", {ep}, 100 * kGiB, 1000);
  const Json entry = listForUser(*db, "u")[0];
  CHECK(outcome["accepted"] == true && entry["seriesName"] == "Une serie" && entry["indexNumber"] == 4);
  CHECK(entry["audioStreamIndex"] == 3 && entry["burnSubtitleIndex"] == 5 && entry["subtitlesExpected"] == 1);
  CHECK(entry["expectedSize"] == 2 * kGiB && entry["autoDeleteAfterWatch"] == true && entry["autoDeleteDelayMinutes"] == 15);
  CHECK(text(*db->prepare("SELECT subtitles_json FROM files").get(), "subtitles_json") ==
        R"([{"index":7,"format":"srt","langTag":"fre"}])");
  CHECK(parseSpecs(R"([{"index":3},{"index":2,"format":"ass"},"x"])").size() == 1);
  CHECK(sanitizeTag("FRE-forced!é") == "fre-forced" && sanitizeTag("!!") == "und");
}

TEST(musique_identifiants_et_chemins) {
  CHECK(music::musicItemId("jf:" + kJf) == kJf);
  CHECK(music::musicItemId("jf:01234567-89AB-cdef-0123-456789abcdef") == kJf);
  const auto id = music::musicItemId("ext:sillon:rec:11111111-2222-3333-4444-555555555555~rel:66666666-7777-8888-9999-000000000000");
  CHECK(id && id->size() == 36 && id->rfind("ext-", 0) == 0);
  CHECK(music::musicItemId("ext:sillon:ytm:t:a") != music::musicItemId("ext:sillon:ytm:t:b"));
  CHECK(!music::musicItemId("jf:../../etc") && !music::musicItemId("autre"));
  CHECK(music::isServerPath("/api/plugins/sillon/music/offline/abc"));
  CHECK(music::isServerPath("/api/plugins/sillon/music/art/q/7c/250?ar=D.Meletis&ti=Giyu+VS+Akaza+-+%28From%29"));
  CHECK(music::isServerPath("/api/x?a=b*c") && !music::isServerPath("/api/x?a=<b>"));
  CHECK(!music::isServerPath("https://ailleurs.exemple/x") && !music::isServerPath("//ailleurs.exemple/api/x"));
  CHECK(!music::isServerPath("/api/../secret") && !music::isServerPath("/autre/chose"));
  CHECK(music::isPublicArtUrl("https://lh3.googleusercontent.com/abc=w544-h544"));
  CHECK(!music::isPublicArtUrl("http://ailleurs.exemple/a.jpg"));
  CHECK(!music::isPublicArtUrl("https://u:p@ailleurs.exemple/a.jpg"));
  CHECK(!music::isPublicArtUrl("https://ailleurs.exemple/a.jpg?token=x"));
  CHECK(!music::isPublicArtUrl("https://ailleurs.exemple/" + std::string(600, 'a')));
  CHECK(music::musicRelPath(kJf, track()) == "media/" + kJf + "/audio-original.flac");
  music::KeepItem light = track();
  light.variant = "light";
  light.preset = "a256";
  CHECK(music::musicRelPath(kJf, light) == "media/" + kJf + "/audio-a256.m4a");
}

TEST(musique_mise_en_file_et_collections) {
  auto db = openMemoryDatabase();
  music::KeepItem far = track();
  far.sourcePath = "https://ailleurs.exemple/a.flac";
  CHECK_THROWS(music::enqueueMusicBatch(*db, "u", {far}, 100 * kGiB, 1));
  music::KeepItem wrongOrigin = track();
  wrongOrigin.origin = "external";
  CHECK_THROWS(music::enqueueMusicBatch(*db, "u", {wrongOrigin}, 100 * kGiB, 1));
  music::KeepItem big = track();
  big.expectedSize = kGiB;
  CHECK(music::enqueueMusicBatch(*db, "u", {big, external()}, kGiB, 1)["accepted"] == false);
  CHECK(music::listMusicForUser(*db, "u").empty());
  music::KeepItem art = track();
  art.artworkPath = "https://ailleurs.exemple/a.jpg";  // pochette refusée : le titre reste
  const Json outcome = music::enqueueMusicBatch(*db, "u", {art, external()}, 100 * kGiB, 1000);
  CHECK(outcome["accepted"] == true);
  const Json kept = music::listMusicForUser(*db, "u");
  CHECK(kept.size() == 2 && kept[0]["trackKey"] == "jf:" + kJf && kept[0]["status"] == "queued");
  CHECK(kept[0]["trackNumber"] == 2 && kept[0]["preparing"] == false && kept[0]["retryAt"].is_null());
  CHECK(listForUser(*db, "u").empty() && music::listMusicForUser(*db, "autre").empty());
  CHECK(music::isMusicItem(*db, kJf) && music::musicItemOfKey(*db, external().trackKey) == music::musicItemId(external().trackKey));
  CHECK(db->prepare("SELECT artwork_path FROM music_meta WHERE item_id = ?").get(kJf)->find("artwork_path")->index() == 0);
  music::saveMusicCollection(*db, "u", {"album:jf:a1", "album", "Piano", "Elegant", kJf, {"jf:2", "jf:1"}}, 5);
  music::saveMusicCollection(*db, "u", {"album:jf:a1", "album", "Piano", "Elegant", kJf, {"jf:1", "jf:2"}}, 6);
  const Json collections = music::listMusicCollections(*db, "u");
  CHECK(collections == Json::parse(R"([{"key":"album:jf:a1","kind":"album","title":"Piano","subtitle":"Elegant","coverItemId":")" +
                                   kJf + R"(","trackKeys":["jf:1","jf:2"],"updatedAt":6}])"));
  CHECK(music::listMusicCollections(*db, "v").empty());
}

TEST(ressources_locales_types_servis) {
  CHECK(localAssetMime("meta/i/primary.jpg") == std::optional<std::string>("image/jpeg"));
  CHECK(localAssetMime("meta/i/item.JSON") == std::optional<std::string>("application/json"));
  CHECK(localAssetMime("media/i/subs/3-fre.srt") == std::optional<std::string>("text/plain; charset=utf-8"));
  CHECK(!localAssetMime("media/i/original-ms.mkv") && !localAssetMime("meta/i/.json") && !localAssetMime("meta/i/x"));
}
