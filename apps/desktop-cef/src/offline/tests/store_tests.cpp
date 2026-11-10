// Portage de `store.test.ts`, `listing.test.ts` et `paths.test.ts`.

#include "offline/core/files.h"
#include "offline/core/listing.h"
#include "offline/core/meta.h"
#include "offline/core/playback.h"
#include "offline/core/queue.h"
#include "tests/testkit.h"

using namespace offline_tests;

TEST(store_deux_comptes_un_fichier) {
  auto db = openMemoryDatabase();
  const auto a = claimOrCreateFile(*db, spec("userA"));
  const auto b = claimOrCreateFile(*db, spec("userB", "item1", 2000));
  CHECK(a.created && !b.created && a.fileId == b.fileId);
  CHECK(countRows(*db, "files") == 1 && countRows(*db, "claims") == 2);
}

TEST(store_fichier_part_au_dernier_claim) {
  Root root;
  writeMedia(root, "media/item1/original-ms1.mkv");
  writeMedia(root, "media/item1/subs/3-fre.srt");
  auto db = openMemoryDatabase();
  const auto o = claimOrCreateFile(*db, spec("userA"));
  claimOrCreateFile(*db, spec("userB"));
  const auto d1 = deleteClaim(*db, root.volume, "userA", o.fileId);
  CHECK(!d1.fileDeleted && fs::exists(root.at("media/item1/original-ms1.mkv")));
  const auto d2 = deleteClaim(*db, root.volume, "userB", o.fileId);
  CHECK(d2.fileDeleted && d2.metaDeleted);
  CHECK(!fs::exists(root.at("media/item1")));  // side-cars compris
  const auto none = deleteClaim(*db, root.volume, "inconnu", 999);
  CHECK(!none.fileDeleted && !none.metaDeleted);
}

TEST(store_annule_reactive_identite_variantes) {
  auto db = openMemoryDatabase();
  const auto o = claimOrCreateFile(*db, spec());
  db->exec("UPDATE files SET status = 'canceled', bytes_done = 42");
  const auto still = claimOrCreateFile(*db, spec("u", "item1", 2000));
  CHECK(still.fileId == o.fileId);
  CHECK(getFile(*db, o.fileId)->status == "queued" && getFile(*db, o.fileId)->bytesDone == 0);
  claimOrCreateFile(*db, lightSpec());
  CHECK(countRows(*db, "files") == 2);
  CHECK(findFile(*db, {"item1", "ms1", "original", std::nullopt}).has_value());
  CHECK(!findFile(*db, {"item1", "ms1", "light", "p1080"}).has_value());
  const Json pub = publicFile(*getFile(*db, o.fileId));
  CHECK(!pub.contains("subtitlesJson") && pub["relPath"] == "media/item1/original-ms1.mkv");
}

TEST(store_resolution_de_source) {
  auto db = openMemoryDatabase();
  const auto light = claimOrCreateFile(*db, lightSpec());
  CHECK(!completeFileForItem(*db, "u", "item1"));  // incomplet : jamais lisible
  const auto original = claimOrCreateFile(*db, spec());
  db->exec("UPDATE files SET status = 'complete'");
  CHECK(completeFileForItem(*db, "u", "item1")->id == original.fileId);
  CHECK(completeFileForItem(*db, "u", "item1")->id != light.fileId);
  CHECK(!completeFileForItem(*db, "autre", "item1"));
}

TEST(listes_cloisonnees_et_completes) {
  auto db = openMemoryDatabase();
  const int64_t fileId = claimOrCreateFile(*db, spec("u", "item1", 1700000000000LL)).fileId;
  ClaimSpec other = lightSpec("userB", "item2");
  claimOrCreateFile(*db, other);
  CHECK(listForUser(*db, "u").size() == 1 && listForUser(*db, "u")[0]["itemId"] == "item1");
  CHECK(listForUser(*db, "userB")[0]["itemId"] == "item2");
  CHECK(listForUser(*db, "userC").empty());
  db->prepare("UPDATE files SET subtitles_json = ? WHERE id = ?").run(R"([{"index":3}])", fileId);
  Json entry = listForUser(*db, "u")[0];
  CHECK(!entry.contains("subtitlesJson") && entry["subtitlesExpected"] == 0);  // sans format : écarté
  CHECK(entry["createdAt"] == 1700000000000LL && entry["lastPlayedAt"].is_null());
  CHECK(entry["played"] == false && entry["positionTicks"] == 0 && entry["libraryId"].is_null());
  upsertItemMeta(*db, {"item1", "movie", {}, {}, "lib-animes", {}, "Un film", {}, {}, {}}, 1000);
  setLibrary(*db, "item1", {"lib-animes", "Animés", "tvshows"});
  markWatched(*db, "u", "item1");
  entry = listForUser(*db, "u")[0];
  CHECK(entry["libraryName"] == "Animés" && entry["libraryType"] == "tvshows" && entry["libraryId"] == "lib-animes");
  CHECK(entry["played"] == true && entry["lastPlayedAt"] == 1 && entry["title"] == "Un film");
  CHECK(stateForItem(*db, "u", "item1")["played"] == true);
  CHECK(stateForItem(*db, "userB", "item1").is_null());
  setStatus(*db, fileId, "paused", std::nullopt, 2000);
  CHECK(listForUser(*db, "u")[0]["pausedByUser"] == false);
  setPausedByUser(*db, fileId, true);
  CHECK(stateForItem(*db, "u", "item1")["pausedByUser"] == true);
  db->exec("DELETE FROM item_meta");
  CHECK(listForUser(*db, "u")[0]["title"].is_null() && listForUser(*db, "u")[0]["kind"].is_null());
}

TEST(listes_progression_par_compte_et_etat_complet) {
  auto db = openMemoryDatabase();
  claimOrCreateFile(*db, spec("userA"));
  claimOrCreateFile(*db, spec("userB"));
  markWatched(*db, "userA", "item1");
  CHECK(listForUser(*db, "userA")[0]["played"] == true && listForUser(*db, "userB")[0]["played"] == false);
  auto db2 = openMemoryDatabase();
  claimOrCreateFile(*db2, lightSpec());
  const auto original = claimOrCreateFile(*db2, spec());
  db2->prepare("UPDATE files SET status = 'complete' WHERE id = ?").run(original.fileId);
  CHECK(stateForItem(*db2, "u", "item1")["id"] == original.fileId);
  CHECK(stateForItem(*db2, "u", "inconnu").is_null());
}

TEST(auto_suppression_differee) {
  auto db = openMemoryDatabase();
  const int64_t fileId = claimOrCreateFile(*db, spec()).fileId;
  setAutoDelete(*db, "u", fileId, true, 30, 1000000);
  CHECK(listForUser(*db, "u")[0]["deleteScheduledAt"].is_null());  // non vu : rien
  markWatched(*db, "u", "item1");
  setAutoDelete(*db, "u", fileId, false, 0, 1000000);
  setAutoDelete(*db, "u", fileId, true, 30, 1000000);
  CHECK(listForUser(*db, "u")[0]["deleteScheduledAt"] == 1000 + 30 * 60);
  setAutoDelete(*db, "u", fileId, true, 60, 9000000);  // rebasé sur le visionnage
  CHECK(listForUser(*db, "u")[0]["deleteScheduledAt"] == 1000 + 60 * 60);
  setAutoDelete(*db, "u", fileId, false, 0, 2000000);
  const Json e = listForUser(*db, "u")[0];
  CHECK(e["autoDeleteAfterWatch"] == false && e["autoDeleteDelayMinutes"] == 0 && e["deleteScheduledAt"].is_null());
  setAutoDelete(*db, "u", fileId, true, -5, 1000000);
  CHECK(listForUser(*db, "u")[0]["autoDeleteDelayMinutes"] == 0);
  setAutoDelete(*db, "u", 999, true, 30, 1000000);  // inconnu : ignoré
}

TEST(paths_safe_join) {
  Root root;
  CHECK(safeJoin(root.volume, "media/abc/file.mkv") == (root.dir.path / "media" / "abc" / "file.mkv").lexically_normal());
  CHECK(safeJoin(root.volume, "media") == (root.dir.path / "media").lexically_normal());
  for (const char* bad : {"../evil", "media/../../evil", "media/../evil", "/etc/passwd", "autre/x", "media/%2e%2e/x", "",
                          "media/./x", "media//x", "..\\..\\evil", "media\\..\\..\\evil", "C:/Windows/System32",
                          "media/x:stream"}) {
    CHECK_THROWS(safeJoin(root.volume, bad));
  }
}

TEST(paths_marge_et_racine) {
  CHECK(hasCapacity(kGiB, 4 * kGiB) && !hasCapacity(kGiB, 3 * kGiB) && !hasCapacity(10 * kGiB, 5 * kGiB));
  CHECK(!hasCapacity(9007199254740991LL, 9007199254740991LL));
  TempDir userData;
  forgetRoot();
  auto db = openMemoryDatabase();
  const Volume v = resolveRoot(*db, userData.path);
  CHECK(v.root == defaultRoot(userData.path) && fs::is_directory(v.rootPath() / "media"));
  CHECK(freeSpace(v) > 0);
  // Changement accepté, mémorisé et relu.
  TempDir elsewhere;
  const std::string target = pathToUtf8(elsewhere.path / "films");
  CHECK(setRoot(*db, target) == target && fs::is_directory(elsewhere.path / "films" / "media"));
  forgetRoot();
  CHECK(resolveRoot(*db, userData.path).root == target);
  // Refus d'écriture : code EN PRÉFIXE, puis la cause.
  TempDir blocked;
  std::ofstream(blocked.path / "pas-un-dossier") << "x";
  try {
    setRoot(*db, pathToUtf8(blocked.path / "pas-un-dossier" / "films"));
    CHECK(false);
  } catch (const std::exception& e) {
    const std::string message = e.what();
    CHECK(message.rfind("root-not-writable: ", 0) == 0 && message.size() > 20);
  }
  db->prepare("INSERT INTO files (item_id, media_source_id, variant, rel_path, created_at, updated_at) VALUES ('i1','ms1','original','media/i1/original-ms1.mkv',1,1)")
      .run();
  CHECK_THROWS(setRoot(*db, pathToUtf8(elsewhere.path / "autre")));
  forgetRoot();
}

TEST(paths_suppressions) {
  Root root;
  writeMedia(root, "media/i1/original-ms1.mkv", "video");
  writeMedia(root, "media/i1/original-ms1.mkv.part", "partiel");
  removeMediaFile(root.volume, "media/i1/original-ms1.mkv");
  CHECK(files::listFiles(root.at("media/i1")).empty());
  removeMediaFile(root.volume, "media/i1/absent.mkv");  // absent : pas une erreur
  CHECK(files::classify(fs::filesystem_error("x", std::make_error_code(std::errc::no_space_on_device))) ==
        files::ErrorKind::DiskFull);
  CHECK(files::describe(fs::filesystem_error("x", fs::path("/d"), std::make_error_code(std::errc::permission_denied))) ==
        "EACCES /d");
}
