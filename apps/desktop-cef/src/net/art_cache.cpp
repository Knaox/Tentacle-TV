// Octave — le cache disque des pochettes (voir art_cache.h et artCache.ts).

#include "net/art_cache.h"

#include <fstream>
#include <map>
#include <mutex>
#include <sstream>
#include <vector>

#include "net/art_policy.h"
#include "net/fs_platform.h"

namespace tentacle::net::art {
namespace fs = std::filesystem;

struct ArtCache::State : std::enable_shared_from_this<ArtCache::State> {
  CacheDeps deps;
  std::mutex mutex;
  std::map<fs::path, std::vector<ServeDone>> inFlight;  // une requête par fichier
  int writes = 0;

  int64_t now() const { return deps.now ? deps.now() : nowMs(); }

  std::optional<ServedArt> readFresh(const fs::path& file, const std::string& key) {
    std::error_code ec;
    if (!fs::is_regular_file(file, ec)) return std::nullopt;
    // `birthtimeMs > 0 ? birthtimeMs : mtimeMs`, comme Electron.
    const auto born = birthTimeMs(file);
    const auto modified = modifiedTimeMs(file);
    const int64_t writtenAt = born && *born > 0 ? *born : modified.value_or(0);
    if (!isFresh(key, writtenAt, now())) return std::nullopt;
    std::ifstream in(file, std::ios::binary);
    if (!in) return std::nullopt;
    std::ostringstream buffer;
    buffer << in.rdbuf();
    std::string bytes = std::move(buffer).str();
    const auto type = sniffImageType(bytes);
    if (!type) return std::nullopt;
    // L'heure d'accès sert l'éviction (les moins récemment servies partent d'abord).
    setModifiedTimeMs(file, now());
    return ServedArt{std::move(bytes), *type, true};
  }

  void evict(const std::string& currentOwnerDir) {
    std::vector<ArtFile> files;
    std::error_code ec;
    for (const auto& owner : fs::directory_iterator(deps.root, ec)) {
      std::error_code ec2;
      if (!owner.is_directory(ec2)) continue;
      for (const auto& entry : fs::directory_iterator(owner.path(), ec2)) {
        const fs::path p = entry.path();
        if (p.extension() == ".part") continue;
        std::error_code ec3;
        if (!entry.is_regular_file(ec3)) continue;
        const auto size = entry.file_size(ec3);
        if (ec3) continue;
        files.push_back({owner.path().filename().string(), p.string(), int64_t(size),
                         modifiedTimeMs(p).value_or(0)});
      }
    }
    for (const std::string& f : evictionPlan(files, currentOwnerDir)) fs::remove(f, ec);
  }

  std::optional<ServedArt> store(const fs::path& file, const std::optional<std::string>& bytes,
                                 const std::string& ownerDir) {
    if (!bytes || int64_t(bytes->size()) > kMaxBytes) return std::nullopt;
    const auto type = sniffImageType(*bytes);
    if (!type) return std::nullopt;
    std::error_code ec;
    fs::create_directories(file.parent_path(), ec);
    const fs::path part = file.string() + "." + std::to_string(currentPid()) + ".part";
    bool written = false;
    if (!ec) {
      std::ofstream out(part, std::ios::binary | std::ios::trunc);
      out.write(bytes->data(), std::streamsize(bytes->size()));
      out.close();
      written = bool(out);
    }
    if (written) {
      fs::rename(part, file, ec);
      if (!ec) {
        writes += 1;
        if (writes == 1 || writes % deps.evictEvery == 0) {
          // Après la réponse, comme `void evict()` d'Electron.
          deps.post([weak = weak_from_this(), ownerDir] {
            if (auto self = weak.lock()) self->evict(ownerDir);
          });
        }
      }
    }
    if (!written || ec) fs::remove(part, ec);  // disque plein ou refusé : servie quand même
    return ServedArt{*bytes, *type, false};
  }
};

ArtCache::ArtCache(CacheDeps deps) : state_(std::make_shared<State>()) {
  state_->deps = std::move(deps);
}

ArtCache::~ArtCache() = default;

void ArtCache::serve(const std::optional<std::string>& owner, const std::string& upstream, ServeDone done) {
  const auto k = key(upstream);
  if (!k) {
    done(std::nullopt);
    return;
  }
  const std::string ownerDir = ownerDirOf(owner);
  const fs::path file = state_->deps.root / ownerDir / fileNameOf(*k);
  if (auto cached = state_->readFresh(file, *k)) {
    done(std::move(cached));
    return;
  }
  {
    std::lock_guard lock(state_->mutex);
    auto [it, first] = state_->inFlight.try_emplace(file);
    it->second.push_back(std::move(done));
    if (!first) return;  // une requête est déjà en route pour ce fichier
  }
  std::weak_ptr<State> weak = state_;
  state_->deps.fetchUpstream(upstream, kMaxBytes, [weak, file, ownerDir](std::optional<std::string> bytes) {
    auto self = weak.lock();
    if (!self) return;
    self->deps.post([weak, file, ownerDir, bytes = std::move(bytes)]() mutable {
      auto s = weak.lock();
      if (!s) return;
      const auto result = s->store(file, bytes, ownerDir);
      std::vector<ServeDone> waiting;
      {
        std::lock_guard lock(s->mutex);
        waiting = std::move(s->inFlight[file]);
        s->inFlight.erase(file);
      }
      for (auto& w : waiting) w(result);
    });
  });
}

void ArtCache::clear() {
  std::error_code ec;
  fs::remove_all(state_->deps.root, ec);
}

}  // namespace tentacle::net::art
