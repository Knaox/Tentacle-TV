// Portage de `transfer.test.ts`, `retryAfter.test.ts` et `node/streamDriver.test.ts`.

#include <fstream>

#include "tests/fake_net.h"

using namespace offline_tests;
using namespace tentacle::offline;

namespace {

struct Run {
  ManualScheduler scheduler;
  FakeNet net;
  StreamDriver driver{net};
  Root root;
  std::optional<TransferEnd> end;
  std::vector<int64_t> progress;

  TransferJob job(const std::string& variant = "original", std::optional<int64_t> expected = std::nullopt) {
    TransferJob j;
    j.url = "https://s/api/downloads/x";
    j.token = "jeton";
    j.finalPath = root.at("media/i1/f.mkv");
    j.variant = variant;
    j.expectedSize = expected;
    j.serverUrl = "https://s";
    return j;
  }
  TransferEnd go(TransferJob j, std::shared_ptr<TransferFlags> flags = std::make_shared<TransferFlags>()) {
    spawn([](Run* self, TransferJob job, std::shared_ptr<TransferFlags> f) -> Task<void> {
      std::function<void(int64_t)> progress = [self](int64_t b) { self->progress.push_back(b); };
      std::function<int64_t()> now = [self] { return self->scheduler.now; };
      auto transfer = runTransfer(self->driver, self->root.volume, job, f, progress, now);
      self->end = co_await transfer;
    }(this, std::move(j), flags));
    scheduler.drain();
    return end.value_or(TransferEnd::failed("pending", -1));
  }
};

std::string read(const fs::path& p) {
  std::ifstream in(p, std::ios::binary);
  return std::string((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
}

}  // namespace

TEST(transfert_nominal_cree_le_dossier_et_renomme) {
  Run r;
  r.net.fallback.chunks = {"ab", "cd"};
  const TransferEnd end = r.go(r.job("original", 4));
  CHECK(end.kind == TransferEnd::Kind::Complete && end.finalSize == 4);
  CHECK(read(r.root.at("media/i1/f.mkv")) == "abcd" && !fs::exists(r.root.at("media/i1/f.mkv.part")));
  r.net.fallback.chunks = {};
  const TransferEnd empty = r.go(r.job("light"));
  CHECK(empty.kind == TransferEnd::Kind::Failed && empty.code == "integrity");  // corps vide
}

TEST(transfert_reprise_par_plage_et_200_qui_l_ignore) {
  Run r;
  writeMedia(r.root, "media/i1/f.mkv.part", "ab");
  r.net.fallback.status = 206;
  r.net.fallback.chunks = {"cd"};
  CHECK(r.go(r.job("original", 4)).kind == TransferEnd::Kind::Complete && r.net.ranges[0] == "bytes=2-");
  CHECK(read(r.root.at("media/i1/f.mkv")) == "abcd");
  Run s;
  writeMedia(s.root, "media/i1/f.mkv.part", "zz");
  s.net.fallback.chunks = {"abcd"};  // 200 malgré la plage : on repart de zéro
  CHECK(s.go(s.job("original", 4)).kind == TransferEnd::Kind::Complete && read(s.root.at("media/i1/f.mkv")) == "abcd");
  Run t;  // `.part` déjà complet : rien ne repart sur le réseau
  writeMedia(t.root, "media/i1/f.mkv.part", "abcd");
  CHECK(t.go(t.job("original", 4)).kind == TransferEnd::Kind::Complete && t.net.opened.empty());
  Run u;  // l'Allégé repart TOUJOURS de zéro
  writeMedia(u.root, "media/i1/f.mkv.part", "vieux");
  u.net.fallback.chunks = {"neuf"};
  CHECK(u.go(u.job("light")).kind == TransferEnd::Kind::Complete && u.net.ranges[0].empty() && read(u.root.at("media/i1/f.mkv")) == "neuf");
}

TEST(transfert_integrite_et_codes_http) {
  Run r;
  CHECK(r.go(r.job("original", 99)).code == "integrity" && !fs::exists(r.root.at("media/i1/f.mkv.part")));
  CHECK(r.go(r.job("light", 99)).kind == TransferEnd::Kind::Complete);  // estimation : pas de contrôle
  for (const auto& [status, code] : std::vector<std::pair<int, std::string>>{{404, "unavailable"}, {401, "network"},
                                                                              {403, "network"}, {500, "network"}}) {
    Run e;
    e.net.fallback.status = status;
    CHECK(e.go(e.job()).code == code);
  }
  Run cut;  // flux coupé en cours : ce qui est reçu reste
  cut.net.fallback.chunks = {"ab"};
  cut.net.fallback.cutAfter = true;
  const TransferEnd end = cut.go(cut.job("original", 4));
  CHECK(end.code == "network" && end.bytesDone == 2 && read(cut.root.at("media/i1/f.mkv.part")) == "ab");
}

TEST(transfert_pause_garde_le_part_annulation_l_efface_transcodage_arrete) {
  Run r;
  r.net.fallback.held = true;
  r.net.fallback.status = 206;
  r.net.fallback.headers = {{"X-Tentacle-Play-Session", "p1"}, {"X-Tentacle-Device-Id", "d1"}};
  auto flags = std::make_shared<TransferFlags>();
  writeMedia(r.root, "media/i1/f.mkv.part", "ab");
  r.go(r.job("original", 9), flags);
  flags->setPause(true);
  r.scheduler.drain();
  CHECK(r.end && r.end->kind == TransferEnd::Kind::Paused && r.end->bytesDone == 2 && fs::exists(r.root.at("media/i1/f.mkv.part")));
  CHECK(r.net.killed.size() == 1 && r.net.killed[0] == "https://s/api/jellyfin/Videos/ActiveEncodings?deviceId=d1&playSessionId=p1");
  Run c;
  c.net.fallback.held = true;
  auto cancel = std::make_shared<TransferFlags>();
  c.go(c.job("light"), cancel);
  cancel->setCancel(true);
  c.scheduler.drain();
  CHECK(c.end && c.end->kind == TransferEnd::Kind::Canceled && !fs::exists(c.root.at("media/i1/f.mkv.part")));
  CHECK(c.net.killed.empty());  // sans session de transcodage, rien à arrêter
}

TEST(retry_after_et_total_annonce) {
  const auto h = [](HeaderList list) { return headerLookup(std::move(list)); };
  CHECK(serverWaitMs(503, h({{"Retry-After", "7"}}), 0) == std::optional<int64_t>(7000));
  CHECK(serverWaitMs(503, h({{"retry-after", " 0 "}}), 0) == std::optional<int64_t>(1000));
  CHECK(serverWaitMs(503, h({{"Retry-After", "999999"}}), 0) == std::optional<int64_t>(6LL * 3600 * 1000));
  CHECK(serverWaitMs(503, h({{"Retry-After", "Wed, 21 Oct 2015 07:28:00 GMT"}}), 1445412470000LL) == std::optional<int64_t>(10000));
  CHECK(!serverWaitMs(500, h({{"Retry-After", "7"}}), 0) && !serverWaitMs(503, h({}), 0));
  CHECK(!serverWaitMs(503, h({{"Retry-After", "bientôt"}}), 0));
  CHECK(announcedTotal(206, h({{"Content-Range", "bytes 10-99/100"}}), 10) == std::optional<int64_t>(100));
  CHECK(announcedTotal(200, h({{"Content-Length", "90"}}), 10) == std::optional<int64_t>(100));
  CHECK(!announcedTotal(200, h({}), 0) && !announcedTotal(200, h({{"Content-Length", "abc"}}), 0));
  CHECK(networkRetryDelay(0) == std::optional<int64_t>(5000) && networkRetryDelay(99) == std::optional<int64_t>(300000));
  CHECK(!networkRetryDelay(0, {}));
}
