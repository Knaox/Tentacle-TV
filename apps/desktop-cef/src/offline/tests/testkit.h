#pragma once
// Fixtures partagées — le `testkit.ts` d'offline-core (mêmes valeurs par défaut).

#include <filesystem>
#include <fstream>
#include <string>

#include "offline/core/paths.h"
#include "offline/core/rows.h"
#include "offline/core/schema.h"
#include "offline/core/store.h"
#include "offline/core/utf8_path.h"
#include "tests/check.h"

namespace offline_tests {

using namespace tentacle::offline;
namespace fs = std::filesystem;

constexpr int64_t kGiB = 1024LL * 1024 * 1024;

/// Racine jetable, `media/` et `meta/` créés (et la racine mémorisée oubliée).
struct Root {
  TempDir dir;
  Volume volume;
  Root() : volume{pathToUtf8(dir.path)} {
    forgetRoot();
    ensureLayout(volume);
  }
  ~Root() { forgetRoot(); }
  fs::path at(const std::string& rel) const { return dir.path / utf8ToPath(rel); }
};

inline void writeMedia(const Root& root, const std::string& rel, const std::string& content = "data") {
  const fs::path target = root.at(rel);
  fs::create_directories(target.parent_path());
  std::ofstream(target, std::ios::binary) << content;
}

/// Le claim par défaut de `testkit.ts`, surchargeable.
inline ClaimSpec spec(const std::string& userId = "u", const std::string& itemId = "item1", int64_t nowMs = 1000) {
  return {{itemId, "ms1", "original", std::nullopt}, userId, "media/" + itemId + "/original-ms1.mkv", 4, false, nowMs};
}

inline ClaimSpec lightSpec(const std::string& userId = "u", const std::string& itemId = "item1") {
  ClaimSpec s = spec(userId, itemId);
  s.identity.variant = "light";
  s.identity.preset = "p720";
  s.relPath = "media/" + itemId + "/light-ms1-p720.mp4";
  return s;
}

inline int64_t countRows(Database& db, const std::string& table) {
  return integer(*db.prepare("SELECT COUNT(*) AS n FROM " + table).get(), "n");
}

inline void markWatched(Database& db, const std::string& userId, const std::string& itemId) {
  db.prepare(
        "INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)\n"
        "     VALUES (?, ?, 0, 1, 1)")
      .run(userId, itemId);
}

}  // namespace offline_tests
