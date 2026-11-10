#include "platform/linux/edid_linux.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iterator>

namespace tentacle::platform {
namespace {

constexpr size_t kBlock = 128;
constexpr uint8_t kCtaExtension = 0x02;
constexpr uint8_t kExtendedTag = 7;
constexpr uint8_t kHdrStaticMetadata = 6;
constexpr uint8_t kHdrEotfMask = 0b1100;  // 2 = PQ (ST 2084), 3 = HLG

std::string readText(const std::filesystem::path& p) {
  std::ifstream in(p);
  std::string s;
  std::getline(in, s);
  return s;
}

}  // namespace

bool edidSupportsHdr(const std::vector<uint8_t>& edid) {
  if (edid.size() < kBlock) return false;
  auto at = [&](size_t i) -> uint8_t { return i < edid.size() ? edid[i] : 0; };
  for (size_t start = kBlock; start + kBlock <= edid.size(); start += kBlock) {
    if (edid[start] != kCtaExtension) continue;
    // Octet 2 : décalage des descripteurs détaillés, donc fin des blocs de données.
    const size_t end = start + std::min<size_t>(at(start + 2), kBlock - 1);
    for (size_t i = start + 4; i < end;) {
      const uint8_t header = at(i);
      const uint8_t length = header & 0x1f;
      if ((header >> 5) == kExtendedTag && length >= 2 && at(i + 1) == kHdrStaticMetadata &&
          (at(i + 2) & kHdrEotfMask) != 0) {
        return true;
      }
      i += 1 + length;
    }
  }
  return false;
}

bool hdrDisplayConnected(const std::string& root) {
  std::error_code ec;
  for (const auto& entry : std::filesystem::directory_iterator(root, ec)) {
    const std::string name = entry.path().filename().string();
    if (name.rfind("card", 0) != 0 || name.find('-') == std::string::npos) continue;
    // Un connecteur illisible n'empêche pas de lire les autres.
    if (readText(entry.path() / "status") != "connected") continue;
    std::ifstream in(entry.path() / "edid", std::ios::binary);
    std::vector<uint8_t> edid((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    if (edidSupportsHdr(edid)) return true;
  }
  return false;
}

}  // namespace tentacle::platform
