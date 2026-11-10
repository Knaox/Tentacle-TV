#pragma once
// Bancs du moteur : une boucle à horloge virtuelle et un réseau simulé (le `testkit.ts`
// d'offline-core : `heldNet`, `immediateNet`).

#include <deque>
#include <map>
#include <string>
#include <vector>

#include "offline/core/engine.h"
#include "offline/core/queue.h"
#include "offline/core/stream_driver.h"
#include "tests/testkit.h"

namespace offline_tests {

/// Une boucle à horloge virtuelle : `drain()` exécute tout ce qui est dû, en avançant l'heure.
class ManualScheduler : public tentacle::offline::Scheduler {
 public:
  int64_t now = 1000;
  void post(std::function<void()> task) override { postDelayed(std::move(task), 0); }
  void postDelayed(std::function<void()> task, int64_t delayMs) override {
    queue_.emplace(now + std::max<int64_t>(0, delayMs), std::make_pair(seq_++, std::move(task)));
  }
  /// Exécute ce qui est dû jusqu'à `until` (au-delà : laissé en attente), heure avancée.
  void runUntil(int64_t until) {
    while (!queue_.empty() && queue_.begin()->first <= until) {
      auto it = queue_.begin();
      now = std::max(now, it->first);
      auto task = std::move(it->second.second);
      queue_.erase(it);
      task();
    }
    now = std::max(now, until);
  }
  /// Ce qui est dû MAINTENANT (sans avancer l'heure vers les minuteurs).
  void drain() { runUntil(now); }
  size_t pending() const { return queue_.size(); }

 private:
  std::multimap<int64_t, std::pair<uint64_t, std::function<void()>>> queue_;
  uint64_t seq_ = 0;
};

/// Un réseau simulé : une réponse par URL (statut, en-têtes, blocs), éventuellement RETENUE
/// jusqu'à `release()`. Note les URL et les `Range` demandées, et les DELETE.
class FakeNet : public tentacle::offline::TransferNet {
 public:
  struct Reply {
    int status = 200;
    tentacle::offline::HeaderList headers;
    std::vector<std::string> chunks = {std::string("\x01\x02\x03", 3)};
    bool held = false;        // blocs retenus jusqu'à release()
    bool cutAfter = false;    // flux coupé après les blocs (réseau)
  };
  Reply fallback;
  std::map<std::string, Reply> replies;  // par préfixe d'URL
  std::vector<std::string> opened, ranges, killed;

  std::function<void()> open(const std::string& url, const tentacle::offline::HeaderList& headers,
                             std::shared_ptr<tentacle::offline::StreamSink> sink) override {
    opened.push_back(url);
    std::string range;
    for (const auto& [k, v] : headers) {
      if (k == "Range") range = v;
    }
    ranges.push_back(range);
    Reply reply = fallback;
    for (const auto& [prefix, r] : replies) {
      if (url.rfind(prefix, 0) == 0) reply = r;
    }
    auto state = std::make_shared<Open>(Open{sink, reply, false});
    sink->onResponse(reply.status, tentacle::offline::headerLookup(reply.headers));
    if (!reply.held) play(state);
    else held_.push_back(state);
    return [state] { cancel(state); };
  }
  void killTranscode(const std::string& url, const tentacle::offline::HeaderList&, std::function<void()> done) override {
    killed.push_back(url);
    done();
  }
  /// Laisse partir les flux retenus.
  void release() {
    auto held = std::move(held_);
    for (auto& state : held) play(state);
  }

 private:
  struct Open {
    std::shared_ptr<tentacle::offline::StreamSink> sink;
    Reply reply;
    bool closed;
  };
  static void play(const std::shared_ptr<Open>& s) {
    for (const auto& chunk : s->reply.chunks) {
      if (s->closed) return;
      s->sink->onData(reinterpret_cast<const uint8_t*>(chunk.data()), chunk.size());
    }
    if (s->closed) return;
    s->closed = true;
    s->sink->onComplete(!s->reply.cutAfter);
  }
  static void cancel(const std::shared_ptr<Open>& s) {
    if (s->closed) return;
    s->closed = true;
    s->sink->onComplete(false);
  }
  std::vector<std::shared_ptr<Open>> held_;
};

/// Un moteur instrumenté (`makeEngine` de testkit.ts) : sans relance par défaut.
struct EngineBench {
  ManualScheduler scheduler;
  FakeNet net;
  tentacle::offline::StreamDriver driver{net};
  std::unique_ptr<Database> db = openMemoryDatabase();
  Root root;
  std::vector<std::string> events;
  std::vector<bool> toggles;
  std::vector<tentacle::offline::HoldState> holds;
  std::unique_ptr<tentacle::offline::DownloadEngine> engine;

  explicit EngineBench(std::function<void(tentacle::offline::EngineDeps&)> tweak = {}) {
    tentacle::offline::EngineDeps deps;
    deps.db = db.get();
    deps.volume = [this] { return root.volume; };
    deps.driver = &driver;
    deps.scheduler = &scheduler;
    deps.makeFetcher = [](const std::string&) -> tentacle::offline::FetchBytes {
      return [](const std::string&, int64_t, std::function<void(std::optional<tentacle::offline::Bytes>)> done) { done(std::nullopt); };
    };
    deps.emit = [this](const std::string& event, const Json&) { events.push_back(event); };
    deps.now = [this] { return scheduler.now; };
    deps.retryDelaysMs = std::vector<int64_t>{};
    deps.networkRetryDelaysMs = std::vector<int64_t>{};
    deps.onBusy = [this](bool busy) { toggles.push_back(busy); };
    deps.onHeld = [this](const tentacle::offline::HoldState& h) { holds.push_back(h); };
    if (tweak) tweak(deps);
    engine = std::make_unique<tentacle::offline::DownloadEngine>(std::move(deps));
  }
  /// Un fichier en file, daté (FIFO sur `created_at`).
  int64_t seed(const std::string& itemId, int64_t at, std::optional<int64_t> expected = std::nullopt) {
    ClaimSpec s = spec("u", itemId, at);
    s.expectedSize = expected;
    return claimOrCreateFile(*db, s).fileId;
  }
  tentacle::offline::FileRow file(int64_t fileId) { return *tentacle::offline::getFile(*db, fileId); }
  std::string status(int64_t fileId) { return file(fileId).status; }
};

}  // namespace offline_tests
