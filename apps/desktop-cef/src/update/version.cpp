#include "update/version.h"

#include <charconv>
#include <vector>

namespace tentacle::update {
namespace {

bool parseNumber(std::string_view s, int& out) {
  if (s.empty() || s.size() > 9) return false;
  if (s.size() > 1 && s[0] == '0') return false;  // pas de zéro en tête (SemVer)
  auto [p, ec] = std::from_chars(s.data(), s.data() + s.size(), out);
  return ec == std::errc() && p == s.data() + s.size();
}

std::vector<std::string_view> split(std::string_view s, char sep) {
  std::vector<std::string_view> parts;
  size_t start = 0;
  for (size_t i = 0; i <= s.size(); ++i) {
    if (i == s.size() || s[i] == sep) {
      parts.push_back(s.substr(start, i - start));
      start = i + 1;
    }
  }
  return parts;
}

bool isNumeric(std::string_view s) {
  if (s.empty()) return false;
  for (char c : s)
    if (c < '0' || c > '9') return false;
  return true;
}

bool validIdentifier(std::string_view s) {
  if (s.empty()) return false;
  for (char c : s) {
    const bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '-';
    if (!ok) return false;
  }
  return true;
}

int comparePre(std::string_view a, std::string_view b) {
  if (a == b) return 0;
  if (a.empty()) return 1;  // la version finale passe après ses pré-versions
  if (b.empty()) return -1;
  const auto pa = split(a, '.'), pb = split(b, '.');
  for (size_t i = 0; i < pa.size() && i < pb.size(); ++i) {
    const bool na = isNumeric(pa[i]), nb = isNumeric(pb[i]);
    if (na && nb) {
      if (pa[i].size() != pb[i].size()) return pa[i].size() < pb[i].size() ? -1 : 1;
    } else if (na != nb) {
      return na ? -1 : 1;  // numérique < alphanumérique
    }
    if (const int c = pa[i].compare(pb[i]); c != 0) return c < 0 ? -1 : 1;
  }
  if (pa.size() == pb.size()) return 0;
  return pa.size() < pb.size() ? -1 : 1;
}

}  // namespace

std::optional<Version> Version::parse(std::string_view text) {
  if (!text.empty() && text[0] == 'v') text.remove_prefix(1);
  if (const size_t plus = text.find('+'); plus != std::string_view::npos) text = text.substr(0, plus);
  std::string_view core = text, pre;
  if (const size_t dash = text.find('-'); dash != std::string_view::npos) {
    core = text.substr(0, dash);
    pre = text.substr(dash + 1);
    for (auto id : split(pre, '.'))
      if (!validIdentifier(id)) return std::nullopt;
  }
  const auto nums = split(core, '.');
  if (nums.size() != 3) return std::nullopt;
  Version v;
  if (!parseNumber(nums[0], v.major) || !parseNumber(nums[1], v.minor) || !parseNumber(nums[2], v.patch))
    return std::nullopt;
  v.pre = std::string(pre);
  return v;
}

std::string Version::str() const {
  std::string s = std::to_string(major) + "." + std::to_string(minor) + "." + std::to_string(patch);
  if (!pre.empty()) s += "-" + pre;
  return s;
}

int compare(const Version& a, const Version& b) {
  if (a.major != b.major) return a.major < b.major ? -1 : 1;
  if (a.minor != b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch != b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePre(a.pre, b.pre);
}

}  // namespace tentacle::update
