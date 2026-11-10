#include "lifecycle/external_url.h"

#include <algorithm>
#include <array>
#include <cctype>

namespace tentacle::lifecycle {

bool externalUrlAllowed(std::string_view url) {
  static constexpr std::array<std::string_view, 6> kSchemes = {
      "http", "https", "mailto", "ms-windows-store", "macappstore", "itms-apps"};
  // `new URL()` refuse les espaces et les caractères de contrôle autour d'une URL valide :
  // on refuse tout caractère de contrôle ou espace, où qu'il soit (rien d'ambigu ne part).
  if (url.empty() || url.size() > 32 * 1024) return false;
  if (std::any_of(url.begin(), url.end(), [](unsigned char c) { return c <= 0x20 || c == 0x7f; })) return false;
  const auto colon = url.find(':');
  if (colon == std::string_view::npos || colon == 0) return false;
  std::string scheme;
  for (char c : url.substr(0, colon)) {
    const auto u = static_cast<unsigned char>(c);
    if (!std::isalnum(u) && c != '+' && c != '-' && c != '.') return false;
    scheme.push_back(char(std::tolower(u)));
  }
  if (std::find(kSchemes.begin(), kSchemes.end(), scheme) == kSchemes.end()) return false;
  // http(s) : une autorité non vide, comme l'exige `new URL()`.
  if (scheme == "http" || scheme == "https") {
    const auto rest = url.substr(colon + 1);
    if (rest.size() < 3 || rest.substr(0, 2) != "//" || rest[2] == '/' || rest[2] == '?' || rest[2] == '#') {
      return false;
    }
  }
  return true;
}

}  // namespace tentacle::lifecycle
