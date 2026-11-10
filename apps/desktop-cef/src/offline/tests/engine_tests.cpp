// Portage de `engine.test.ts`, `engineActivity.test.ts`, `engineHold.test.ts`,
// `networkRetry.test.ts` et `musicLane.test.ts` (hors finalisation MP4 : le bureau n'en a pas).

#include "tests/fake_net.h"

using namespace offline_tests;
using tentacle::offline::Creds;

namespace {
const Creds kCreds{"https://tv.exemple", "jeton"};
}

TEST(moteur_un_seul_film_a_la_fois) {
  EngineBench b;
  b.net.fallback.held = true;
  const int64_t a = b.seed("item1", 1), c = b.seed("item2", 2), d = b.seed("item3", 3);
  b.engine->start(kCreds);
  b.scheduler.drain();
  CHECK(b.net.opened.size() == 1 && b.status(a) == "downloading" && b.status(c) == "queued");
  CHECK(b.engine->pending() == 3 && b.toggles == std::vector<bool>{true});
  b.net.release();
  b.scheduler.drain();
  CHECK(b.status(a) == "complete" && b.net.opened.size() == 2 && b.status(c) == "downloading");
  b.net.release();
  b.scheduler.drain();
  b.net.release();
  b.scheduler.drain();
  CHECK(b.status(c) == "complete" && b.status(d) == "complete" && b.engine->pending() == 0);
  // La bascule occupé/inoccupé ne signale qu'aux transitions : la file a tourné sans trou.
  CHECK(b.toggles == (std::vector<bool>{true, false}));
}

TEST(moteur_fin_reussie_complete_et_promue) {
  EngineBench b;
  const int64_t id = b.seed("item1", 1);
  b.engine->start(kCreds);
  b.scheduler.drain();
  const auto f = b.file(id);
  CHECK(f.status == "complete" && f.bytesDone == 3 && f.retryCount == 0);
  CHECK(fs::exists(b.root.at("media/item1/original-ms1.mkv")) && !fs::exists(b.root.at("media/item1/original-ms1.mkv.part")));
  CHECK(b.net.opened[0] == "https://tv.exemple/api/downloads/original/item1?mediaSourceId=ms1");
  CHECK(std::count(b.events.begin(), b.events.end(), "downloads://changed") >= 2);
  CHECK(b.toggles == (std::vector<bool>{true, false}));
}

TEST(moteur_coupure_reseau_pause_systeme_et_relance) {
  EngineBench b([](tentacle::offline::EngineDeps& d) { d.networkRetryDelaysMs = std::vector<int64_t>{5000, 15000}; });
  b.net.fallback.cutAfter = true;  // 3 octets reçus, puis coupé
  const int64_t id = b.seed("item1", 1);
  b.engine->start(kCreds);
  b.scheduler.drain();
  auto f = b.file(id);
  CHECK(f.status == "paused" && !isPausedByUser(*b.db, id) && !f.errorCode && f.bytesDone == 3);
  CHECK(f.nextRetryAt == std::optional<int64_t>(b.scheduler.now + 5000));  // octets reçus : 1re marche
  CHECK(b.holds.back().awaitingRetry && !b.holds.back().awaitingServer && !b.holds.back().transferring);
  b.net.fallback.cutAfter = false;
  b.net.fallback.status = 206;  // le serveur honore la plage
  b.scheduler.runUntil(b.scheduler.now + 5000);
  CHECK(b.net.opened.size() == 2 && b.net.ranges[1] == "bytes=3-");  // reprise par plage
  f = b.file(id);
  CHECK(f.status == "complete" && f.bytesDone == 6 && !f.nextRetryAt);
}

TEST(moteur_404_erreur_et_503_attente_du_serveur) {
  EngineBench b;
  b.net.fallback.status = 404;
  const int64_t id = b.seed("item1", 1);
  b.engine->start(kCreds);
  b.scheduler.drain();
  CHECK(b.status(id) == "error" && b.file(id).errorCode == std::optional<std::string>("unavailable"));
  EngineBench w;
  w.net.fallback.status = 503;
  w.net.fallback.headers = {{"Retry-After", "7"}};
  const int64_t m = w.seed("item1", 1);
  w.engine->start(kCreds);
  w.scheduler.drain();
  const auto f = w.file(m);
  CHECK(f.status == "paused" && f.nextRetryAt == std::optional<int64_t>(w.scheduler.now + 7000));
  CHECK(w.holds.back().awaitingServer && w.engine->held().awaitingRetry);
}

TEST(moteur_gestes_pause_reprise_annulation) {
  EngineBench b;
  b.net.fallback.held = true;
  const int64_t a = b.seed("item1", 1), c = b.seed("item2", 2);
  b.engine->start(kCreds);
  b.scheduler.drain();
  b.engine->pause(c);  // encore en file : sorti de la file
  CHECK(b.status(c) == "paused" && isPausedByUser(*b.db, c));
  b.engine->pause(a);  // en vol : la bascule
  b.scheduler.drain();
  CHECK(b.status(a) == "paused" && isPausedByUser(*b.db, a) && b.engine->pending() == 0);
  b.net.fallback.held = false;
  b.engine->resume(a);
  b.scheduler.drain();
  CHECK(b.status(a) == "complete" && b.status(c) == "paused");  // la pause explicite reste
  // Annuler en vol : canceled, `.part` effacé, aucune relance.
  b.net.fallback.held = true;
  b.engine->resume(c);
  b.scheduler.drain();
  b.engine->cancel(c);
  b.scheduler.drain();
  const auto f = b.file(c);
  CHECK(f.status == "canceled" && f.bytesDone == 0 && !f.nextRetryAt && !fs::exists(b.root.at("media/item2/original-ms1.mkv.part")));
  b.net.release();
  b.scheduler.drain();
  CHECK(b.status(c) == "canceled");  // une fin tardive ne recouvre pas l'intention
}

TEST(moteur_redemarrage_et_sans_identifiants) {
  EngineBench b;
  const int64_t a = b.seed("item1", 1), c = b.seed("item2", 2);
  b.engine->pump();  // sans identifiants : rien
  b.scheduler.drain();
  CHECK(b.net.opened.empty() && b.engine->pending() == 0 && b.status(a) == "queued");
  // Un `downloading` interrompu (app tuée) et une pause système repartent ; la pause
  // explicite reste ; une ligne annulée aussi.
  setStatus(*b.db, a, "downloading", std::nullopt, 5);
  setStatus(*b.db, c, "paused", std::nullopt, 5);
  const int64_t d = b.seed("item3", 3);
  setStatus(*b.db, d, "canceled", std::nullopt, 5);
  const int64_t e = b.seed("item4", 4);
  setStatus(*b.db, e, "paused", std::nullopt, 5);
  setPausedByUser(*b.db, e, true);
  b.engine->start(kCreds);
  b.scheduler.drain();
  CHECK(b.status(a) == "complete" && b.status(c) == "complete" && b.status(d) == "canceled" && b.status(e) == "paused");
}

TEST(moteur_pauses_systeme_reprises_au_reveil) {
  EngineBench b;
  b.net.fallback.held = true;
  const int64_t a = b.seed("item1", 1), c = b.seed("item2", 2);
  b.engine->start(kCreds);
  b.scheduler.drain();
  b.engine->suspendForSystem();
  b.scheduler.drain();
  CHECK(b.status(a) == "paused" && b.status(c) == "paused" && !isPausedByUser(*b.db, a) && !isPausedByUser(*b.db, c));
  b.net.fallback.held = false;
  b.engine->resumeSystemPauses();
  b.scheduler.drain();
  CHECK(b.status(a) == "complete" && b.status(c) == "complete");
}

TEST(moteur_trois_titres_de_musique_jamais_a_cote_d_un_film) {
  EngineBench b([](tentacle::offline::EngineDeps& d) { d.musicParallelLimit = [] { return int64_t{3}; }; });
  b.net.fallback.held = true;
  std::vector<int64_t> tracks;
  for (int i = 0; i < 4; ++i) {
    const int64_t id = b.seed("t" + std::to_string(i), 10 + i);
    b.db->prepare("UPDATE files SET source_path = ? WHERE id = ?").run("/api/plugins/x/offline/" + std::to_string(i), id);
    tracks.push_back(id);
  }
  const int64_t film = b.seed("film", 100);
  b.engine->start(kCreds);
  b.scheduler.drain();
  CHECK(b.net.opened.size() == 3 && b.status(tracks[3]) == "queued" && b.status(film) == "queued");
  CHECK(b.file(tracks[0]).phase == std::optional<std::string>("prepare") || b.file(tracks[0]).phase == std::nullopt);
  CHECK(b.net.opened[0] == "https://tv.exemple/api/plugins/x/offline/0");
  b.net.release();
  b.scheduler.drain();
  b.net.release();
  b.scheduler.drain();
  b.net.release();
  b.scheduler.drain();
  CHECK(b.status(tracks[3]) == "complete" && b.status(film) == "complete" && !b.file(tracks[0]).phase);
}

TEST(moteur_relance_d_une_erreur_reparable) {
  EngineBench b([](tentacle::offline::EngineDeps& d) { d.retryDelaysMs = std::vector<int64_t>{5000}; });
  const int64_t id = b.seed("item1", 1, 99);  // taille annoncée fausse : intégrité, pas relancée
  b.engine->start(kCreds);
  b.scheduler.drain();
  CHECK(b.status(id) == "error" && b.file(id).errorCode == std::optional<std::string>("integrity") && !b.file(id).nextRetryAt);
  CHECK(!fs::exists(b.root.at("media/item1/original-ms1.mkv.part")));
  // `io` se relance seul (le dossier de l'item est un FICHIER : pas d'écriture possible).
  EngineBench c([](tentacle::offline::EngineDeps& d) { d.retryDelaysMs = std::vector<int64_t>{5000}; });
  writeMedia(c.root, "media/item1", "pas un dossier");
  const int64_t j = c.seed("item1", 1);
  c.engine->start(kCreds);
  c.scheduler.drain();
  CHECK(c.status(j) == "error" && c.file(j).errorCode == std::optional<std::string>("io"));
  CHECK(c.file(j).nextRetryAt == std::optional<int64_t>(c.scheduler.now + 5000) && c.file(j).retryCount == 1);
}
