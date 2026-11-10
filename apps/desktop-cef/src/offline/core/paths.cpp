#include "offline/core/paths.h"

#include <optional>
#include <stdexcept>
#include <vector>

#include "offline/core/files.h"
#include "offline/core/rows.h"
#include "offline/core/schema.h"
#include "offline/core/utf8_path.h"

namespace tentacle::offline {
namespace fs = std::filesystem;
namespace {

/// Volume résolu, une seule lecture SQLite par session (le fil hors ligne seul y touche).
std::optional<Volume> g_cache;

bool simpleSegment(const std::string& segment) {
  // Vide = séparateur doublé ou chemin absolu ; `:` = lettre de lecteur ou flux de données
  // alternatif NTFS.
  return !segment.empty() && segment != "." && segment != ".." && segment.find(':') == std::string::npos &&
         segment.find('\0') == std::string::npos;
}

}  // namespace

fs::path Volume::rootPath() const { return utf8ToPath(root); }

std::string defaultRoot(const fs::path& userDataDir) { return pathToUtf8(userDataDir / "downloads"); }

void ensureLayout(const Volume& volume) {
  for (const char* sub : {"media", "meta"}) files::mkdirp(volume.rootPath() / sub);
}

Volume resolveRoot(Database& db, const fs::path& userDataDir) {
  if (g_cache) return *g_cache;
  Volume volume{settingGet(db, kStorageRootKey).value_or(defaultRoot(userDataDir))};
  ensureLayout(volume);
  g_cache = volume;
  return volume;
}

void forgetRoot() { g_cache.reset(); }

std::string setRoot(Database& db, const std::string& newRoot) {
  const auto row = db.prepare("SELECT COUNT(*) AS n FROM files").get();
  if (row && integer(*row, "n") > 0) throw std::runtime_error("root-not-empty");

  const Volume volume{newRoot};
  try {
    files::mkdirp(volume.rootPath());
    ensureLayout(volume);
    // Un dossier créable n'est pas forcément inscriptible — lecteur réseau en lecture seule,
    // quota, ACL. On écrit vraiment pour le savoir.
    const fs::path probe = volume.rootPath() / ".tentacle-write-probe";
    files::writeText(probe, "ok");
    files::remove(probe);
  } catch (const std::exception& error) {
    // Le code reste le PRÉFIXE (lu tel quel par la page) ; la cause système suit : `EPERM`,
    // `EACCES`, `EROFS` appellent trois conduites différentes.
    throw std::runtime_error("root-not-writable: " + files::describe(error));
  }

  settingSet(db, kStorageRootKey, newRoot);
  g_cache = volume;
  return newRoot;
}

int64_t freeSpace(const Volume& volume) { return files::freeSpace(volume.rootPath()); }

fs::path safeJoin(const Volume& volume, const std::string& rel) {
  if (rel.empty() || rel.find('%') != std::string::npos) throw std::runtime_error("invalid-path");
  std::vector<std::string> segments;
  size_t start = 0;
  for (size_t i = 0; i <= rel.size(); ++i) {
    if (i == rel.size() || rel[i] == '/' || rel[i] == '\\') {
      segments.push_back(rel.substr(start, i - start));
      start = i + 1;
    }
  }
  if (segments[0] != "media" && segments[0] != "meta") throw std::runtime_error("invalid-path");
  for (const auto& segment : segments) {
    if (!simpleSegment(segment)) throw std::runtime_error("invalid-path");
  }
  // L'invariant qui compte : le résultat reste SOUS la racine (les autres barrières n'en sont
  // que les gardiennes). La racine est normalisée comme `path.join` le fait.
  const fs::path base = volume.rootPath().lexically_normal();
  fs::path joined = base;
  for (const auto& segment : segments) joined /= utf8ToPath(segment);
  joined = joined.lexically_normal();
  std::string baseText = pathToUtf8(base);
  const char sep = static_cast<char>(fs::path::preferred_separator);
  if (baseText.empty() || baseText.back() != sep) baseText.push_back(sep);
  if (pathToUtf8(joined).rfind(baseText, 0) != 0) throw std::runtime_error("invalid-path");
  return joined;
}

void removeMediaFile(const Volume& volume, const std::string& rel) {
  const fs::path target = safeJoin(volume, rel);
  fs::path part = target;
  part += ".part";
  for (const fs::path& file : {target, part}) {
    try {
      files::remove(file);
    } catch (const std::exception& error) {
      throw std::runtime_error("remove " + rel + ": " + files::describe(error));
    }
  }
}

void removeItemMetaDir(const Volume& volume, const std::string& itemId) {
  files::removeTree(safeJoin(volume, "meta/" + itemId));
}

void removeItemMediaDir(const Volume& volume, const std::string& itemId) {
  files::removeTree(safeJoin(volume, "media/" + itemId));
}

bool mediaFileExists(const Volume& volume, const std::string& rel) {
  try {
    return files::exists(safeJoin(volume, rel));
  } catch (...) {
    return false;
  }
}

}  // namespace tentacle::offline
