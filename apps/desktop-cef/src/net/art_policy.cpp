// Octave — la règle du cache des pochettes (voir art_policy.h et artCachePolicy.ts).

#include "net/art_policy.h"

#include <algorithm>
#include <map>

#include "net/sha256.h"
#include "net/web_url.h"

namespace tentacle::net::art {
namespace {

bool isTokenParam(const std::string& name) {
  const std::string l = toLowerAscii(name);
  return l == "api_key" || l == "apikey" || l == "x-emby-token" || l == "token";
}

}  // namespace

bool isFetchable(std::string_view upstream) {
  if (upstream.size() > 2'000) return false;
  const auto url = parseHttpUrl(upstream);
  return url && url->username.empty() && url->password.empty();
}

std::optional<std::string> key(std::string_view upstream) {
  if (!isFetchable(upstream)) return std::nullopt;
  const auto url = parseHttpUrl(upstream);
  FormParams params;
  for (auto& p : parseFormQuery(url->query.value_or(""))) {
    if (!isTokenParam(p.first)) params.push_back(std::move(p));
  }
  // `Array.prototype.sort` est stable : `stable_sort`, même comparaison.
  std::stable_sort(params.begin(), params.end(), [](const auto& a, const auto& b) {
    const int c = a.first == b.first ? localeCompare(a.second, b.second) : localeCompare(a.first, b.first);
    return c < 0;
  });
  std::string query;
  for (const auto& [k, v] : params) {
    if (!query.empty()) query += '&';
    query += encodeUriComponent(k) + "=" + encodeUriComponent(v);
  }
  return url->origin() + url->path + (query.empty() ? "" : "?" + query);
}

bool isTagged(std::string_view key) {
  // /[?&]tag=/
  for (size_t at = key.find("tag="); at != std::string_view::npos; at = key.find("tag=", at + 1)) {
    if (at > 0 && (key[at - 1] == '?' || key[at - 1] == '&')) return true;
  }
  return false;
}

bool isFresh(std::string_view key, int64_t writtenAt, int64_t now) {
  return isTagged(key) || now - writtenAt <= kUntaggedMaxAgeMs;
}

std::optional<std::string> sniffImageType(std::string_view bytes) {
  if (bytes.size() < 12) return std::nullopt;
  const auto b = [&](size_t i) { return static_cast<unsigned char>(bytes[i]); };
  if (b(0) == 0xff && b(1) == 0xd8 && b(2) == 0xff) return "image/jpeg";
  if (b(0) == 0x89 && b(1) == 0x50 && b(2) == 0x4e && b(3) == 0x47) return "image/png";
  if (b(0) == 0x47 && b(1) == 0x49 && b(2) == 0x46) return "image/gif";
  if (bytes.substr(0, 4) == "RIFF" && bytes.substr(8, 4) == "WEBP") return "image/webp";
  if (bytes.substr(4, 8) == "ftypavif") return "image/avif";
  return std::nullopt;
}

std::vector<std::string> evictionPlan(const std::vector<ArtFile>& files,
                                      const std::optional<std::string>& currentOwner,
                                      int64_t maxBytes, int maxOwners) {
  // Dans l'ordre d'apparition des identités (une `Map` JavaScript garde l'ordre d'insertion).
  std::vector<std::string> owners;
  std::map<std::string, std::vector<ArtFile>> byOwner;
  for (const ArtFile& f : files) {
    auto [it, fresh] = byOwner.try_emplace(f.owner);
    if (fresh) owners.push_back(f.owner);
    it->second.push_back(f);
  }
  const auto recency = [&](const std::string& owner) {
    int64_t m = INT64_MIN;
    for (const ArtFile& f : byOwner[owner]) m = std::max(m, f.usedAt);
    return m;
  };
  std::stable_sort(owners.begin(), owners.end(), [&](const std::string& a, const std::string& b) {
    if (currentOwner && a == *currentOwner) return b != *currentOwner;
    if (currentOwner && b == *currentOwner) return false;
    return recency(b) < recency(a);
  });
  std::vector<std::string> drop;
  for (size_t rank = 0; rank < owners.size(); ++rank) {
    std::vector<ArtFile> list = byOwner[owners[rank]];
    std::stable_sort(list.begin(), list.end(), [](const ArtFile& a, const ArtFile& b) { return b.usedAt < a.usedAt; });
    int64_t bytes = 0;
    for (const ArtFile& f : list) {
      bytes += f.size;
      if (int(rank) >= maxOwners || bytes > maxBytes) drop.push_back(f.path);
    }
  }
  return drop;
}

std::string ownerDirOf(const std::optional<std::string>& owner) {
  if (!owner || owner->empty()) return "anonyme";
  return sha256Hex(*owner).substr(0, 24);
}

std::string fileNameOf(std::string_view key) { return sha256Hex(key).substr(0, 40); }

}  // namespace tentacle::net::art
