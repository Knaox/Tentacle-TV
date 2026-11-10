#include "shell/navigation_rule.h"

#include <algorithm>
#include <array>
#include <cctype>

namespace tentacle::nav {
namespace {

std::string g_appOrigin;

char lower(char c) { return char(std::tolower(static_cast<unsigned char>(c))); }

// Ce que `new URL` retire avant d'analyser : contrôles et espaces de tête et de queue,
// tabulations et retours à la ligne partout.
std::string cleaned(std::string_view url) {
  size_t b = 0, e = url.size();
  while (b < e && static_cast<unsigned char>(url[b]) <= 0x20) ++b;
  while (e > b && static_cast<unsigned char>(url[e - 1]) <= 0x20) --e;
  std::string out;
  out.reserve(e - b);
  for (size_t i = b; i < e; ++i) {
    if (url[i] != '\t' && url[i] != '\n' && url[i] != '\r') out.push_back(url[i]);
  }
  return out;
}

// Port par défaut d'un schéma « spécial » : `new URL` l'efface de l'hôte.
std::string_view defaultPort(std::string_view scheme) {
  if (scheme == "http" || scheme == "ws") return "80";
  if (scheme == "https" || scheme == "wss") return "443";
  if (scheme == "ftp") return "21";
  return {};
}

}  // namespace

std::string schemeOf(std::string_view raw) {
  const std::string url = cleaned(raw);
  if (url.empty() || !std::isalpha(static_cast<unsigned char>(url[0]))) return {};
  std::string scheme;
  for (char c : url) {
    if (c == ':') return scheme;
    if (!std::isalnum(static_cast<unsigned char>(c)) && c != '+' && c != '-' && c != '.') return {};
    scheme.push_back(lower(c));
  }
  return {};  // pas de « : »
}

std::string originOf(std::string_view raw) {
  const std::string scheme = schemeOf(raw);
  if (scheme.empty()) return {};
  const std::string url = cleaned(raw);
  std::string_view rest = std::string_view(url).substr(scheme.size() + 1);
  if (rest.size() < 2 || rest[0] != '/' || rest[1] != '/') return {};
  rest.remove_prefix(2);
  const size_t end = rest.find_first_of("/?#\\");
  std::string_view authority = rest.substr(0, end);
  if (const size_t at = authority.rfind('@'); at != std::string_view::npos) {
    authority.remove_prefix(at + 1);
  }
  std::string host(authority);
  std::transform(host.begin(), host.end(), host.begin(), lower);
  // Port par défaut retiré (« http://a:80 » est l'origine « http://a »). Les crochets d'IPv6
  // gardent leurs « : » : on ne coupe qu'après le dernier « ] ».
  const size_t colon = host.rfind(':');
  const size_t bracket = host.rfind(']');
  if (colon != std::string::npos && (bracket == std::string::npos || colon > bracket)) {
    const std::string_view port = std::string_view(host).substr(colon + 1);
    if (port.empty() || port == defaultPort(scheme)) host.erase(colon);
  }
  return scheme + "://" + host;
}

bool externalSchemeAllowed(std::string_view url) {
  // `EXTERNAL_SCHEMES` de security.ts, sans un de plus.
  static constexpr std::array<std::string_view, 6> kAllowed = {
      "http", "https", "mailto", "ms-windows-store", "macappstore", "itms-apps"};
  const std::string scheme = schemeOf(url);
  return std::find(kAllowed.begin(), kAllowed.end(), scheme) != kAllowed.end();
}

void setAppOrigin(std::string_view startUrl) { g_appOrigin = originOf(startUrl); }

const std::string& appOrigin() { return g_appOrigin; }

bool isAppUrl(std::string_view url) {
  return !g_appOrigin.empty() && originOf(url) == g_appOrigin;
}

Verdict mainFrameNavigation(std::string_view url, bool isRedirect) {
  if (isAppUrl(url)) return Verdict::allow;
  return isRedirect ? Verdict::deny : Verdict::denyOpenExternal;
}

Verdict windowOpen(std::string_view /*url*/) { return Verdict::denyOpenExternal; }

}  // namespace tentacle::nav
