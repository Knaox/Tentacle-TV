#include "shell/web_root.h"

#include <system_error>

namespace tentacle::webroot {
namespace fs = std::filesystem;

namespace {

int hexValue(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

bool isRegularFile(const fs::path& p) {
  std::error_code ec;
  return fs::is_regular_file(p, ec);
}

// `candidate` est-il `root` ou un descendant ? Comparaison par éléments, sur des chemins
// déjà normalisés : `/web-evil` n'est pas sous `/web`.
bool isWithin(const fs::path& root, const fs::path& candidate) {
  auto r = root.begin(), c = candidate.begin();
  for (; r != root.end(); ++r, ++c) {
    if (r->empty()) continue;  // séparateur final de la racine
    if (c == candidate.end() || *r != *c) return false;
  }
  return true;
}

}  // namespace

std::string percentDecode(const std::string& encoded) {
  std::string out;
  out.reserve(encoded.size());
  for (size_t i = 0; i < encoded.size(); ++i) {
    if (encoded[i] == '%' && i + 2 < encoded.size()) {
      const int hi = hexValue(encoded[i + 1]), lo = hexValue(encoded[i + 2]);
      if (hi >= 0 && lo >= 0) {
        out.push_back(static_cast<char>(hi * 16 + lo));
        i += 2;
        continue;
      }
    }
    out.push_back(encoded[i]);
  }
  return out;
}

Resolution resolve(const fs::path& root, const std::string& urlPath) {
  const fs::path base = root.lexically_normal();
  std::string decoded = percentDecode(urlPath);
  // Un octet nul couperait le chemin côté système : refusé comme une traversée.
  if (decoded.find('\0') != std::string::npos) return {403, {}};
  const size_t start = decoded.find_first_not_of('/');
  decoded = start == std::string::npos ? std::string() : decoded.substr(start);

  if (decoded == "api" || decoded.rfind("api/", 0) == 0) return {404, {}};

  const fs::path candidate = (base / decoded).lexically_normal();
  if (!isWithin(base, candidate)) return {403, {}};

  if (candidate.has_extension() && isRegularFile(candidate)) return {200, candidate};
  const fs::path index = base / "index.html";
  if (isRegularFile(index)) return {200, index};
  return {404, {}};
}

}  // namespace tentacle::webroot
