#pragma once
// Un faux système pour tester le moteur hors ligne : horloge et minuteries à la main,
// réseau scripté, travail « en arrière-plan » exécuté sur-le-champ.

#include <sodium.h>

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <map>
#include <nlohmann/json.hpp>

#include "update/crypto.h"
#include "update/platform.h"

namespace tentacle::update::testing {

struct TestKey {
  unsigned char pk[crypto_sign_PUBLICKEYBYTES], sk[crypto_sign_SECRETKEYBYTES];
  TestKey() { crypto_sign_keypair(pk, sk); }
  TrustedKey trusted(std::string id = "test") const {
    TrustedKey t{std::move(id), {}};
    std::copy(pk, pk + 32, t.key.begin());
    return t;
  }
  std::string envelope(const std::string& manifest, const std::string& keyId = "test") const {
    unsigned char sig[crypto_sign_BYTES];
    crypto_sign_detached(sig, nullptr, reinterpret_cast<const unsigned char*>(manifest.data()), manifest.size(), sk);
    return nlohmann::json{{"format", 1}, {"keyId", keyId}, {"manifest", manifest},
                          {"signature", base64Encode(sig, sizeof sig)}}.dump();
  }
};

class FakePlatform : public Platform {
 public:
  std::string version = "1.0.0";
  std::string dir;
  int64_t clock = 1'800'000'000;
  bool writable = true;
  std::string cannotWhy = "read-only";  // raison rendue quand !writable (package-manager, msix-managed…)
  std::optional<std::string> feed;  // nullopt : hors ligne
  std::map<std::string, std::string> files;  // URL → contenu servi
  bool downloadNetworkError = false;
  bool holdDownload = false;  // le téléchargement attend `finishDownload()`
  std::string stageError;
  std::vector<std::pair<int64_t, std::function<void()>>> timers;
  std::vector<std::string> applied;  // « <chemin>|<version>|relance »
  std::vector<std::string> rollbacks, removed, discarded;
  bool holdFetch = false;  // le contrôle attend `finishFetch()`
  int quits = 0, fetches = 0;

  // Dossier d'état jetable, portable (les tests se compilent aussi pour Windows).
  FakePlatform() {
    namespace fs = std::filesystem;
    for (;;) {
      const fs::path d = fs::temp_directory_path() / ("tentacle-update-test-" + std::to_string(randombytes_random()));
      if (fs::create_directory(d)) {
        dir = d.string();
        break;
      }
    }
  }
  ~FakePlatform() override {
    std::error_code ec;
    std::filesystem::remove_all(dir, ec);
  }

  // Lance les minuteries échues (une passe).
  void runTimers() {
    auto due = std::move(timers);
    timers.clear();
    for (auto& t : due) t.second();
  }
  void finishFetch() {
    if (pendingFetch_) std::exchange(pendingFetch_, nullptr)();
  }
  void finishDownload() {
    holdDownload = false;
    if (pending_) std::exchange(pending_, nullptr)();
  }

  std::optional<Version> currentVersion() override { return Version::parse(version); }
  std::string platformKey() override { return "macos-arm64"; }
  std::string stateDir() override { return dir; }
  int64_t now() override { return clock; }
  bool canSelfUpdate(std::string* why) override {
    if (!writable && why) *why = cannotWhy;
    return writable;
  }
  void fetch(const std::string&, size_t, FetchDone done) override {
    fetches++;
    auto run = [this, done] {
      if (feed) done(*feed, "");
      else done(std::nullopt, "offline");
    };
    if (holdFetch) pendingFetch_ = run;
    else run();
  }
  void download(const std::string& url, const std::string& dest, Progress progress, DownloadDone done) override {
    auto run = [=, this] {
      if (downloadNetworkError || !files.count(url)) return done("offline", true);
      const std::string& body = files[url];
      progress(body.size() / 2, body.size());
      std::ofstream(dest, std::ios::binary) << body;
      progress(body.size(), body.size());
      done("", false);
    };
    if (holdDownload) pending_ = run;
    else run();
  }
  void cancelDownload() override { pending_ = nullptr; }
  void background(std::function<void()> work, std::function<void()> then) override {
    work();
    then();
  }
  void schedule(int64_t delayMs, std::function<void()> fn) override { timers.emplace_back(delayMs, std::move(fn)); }
  std::string stage(const std::string&, const Manifest& m, std::string* staged) override {
    if (!stageError.empty()) return stageError;
    *staged = dir + "/staged-" + m.version.str();
    return {};
  }
  void discardStaged(const std::string& staged) override { discarded.push_back(staged); }
  std::string apply(const std::string& staged, const Version& v, bool relaunch) override {
    applied.push_back(staged + "|" + v.str() + "|" + (relaunch ? "relaunch" : "quit"));
    return {};
  }
  std::string rollback(const Probation& p) override {
    rollbacks.push_back(p.version);
    if (syncRollback) {  // comme Linux : échange immédiat, retour arrière noté tout de suite
      Probation back = p;
      back.rolledBack = p.version;
      back.previousPath.clear();
      saveProbation(dir + "/probation.json", back);
    }
    return {};
  }
  bool syncRollback = false;
  void removeTree(const std::string& path) override { removed.push_back(path); }
  void quitApp() override { quits++; }

 private:
  std::function<void()> pending_, pendingFetch_;
};

}  // namespace tentacle::update::testing
