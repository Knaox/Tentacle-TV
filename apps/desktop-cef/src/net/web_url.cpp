// L'analyseur d'URL du WHATWG, réduit aux schémas spéciaux http(s) (voir web_url.h).

#include "net/web_url.h"

#include <cstdint>
#include <string>

namespace tentacle::net {
namespace {

bool isAlpha(char c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'); }
bool isDigit(char c) { return c >= '0' && c <= '9'; }
bool isHex(char c) { return isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'); }

// Points de code interdits dans un domaine (« forbidden domain code point »), après décodage.
bool forbiddenInDomain(unsigned char c) {
  if (c <= 0x20 || c == 0x7f) return true;
  switch (c) {
    case '#': case '%': case '/': case ':': case '<': case '>': case '?': case '@':
    case '[': case '\\': case ']': case '^': case '|':
      return true;
    default:
      return false;
  }
}

// Un nombre d'une IPv4 (« IPv4 number parser ») : 0x… hexadécimal, 0… octal, sinon décimal.
std::optional<uint64_t> ipv4Number(std::string_view part) {
  int radix = 10;
  if (part.size() >= 2 && part[0] == '0' && (part[1] == 'x' || part[1] == 'X')) {
    part.remove_prefix(2);
    radix = 16;
  } else if (part.size() >= 2 && part[0] == '0') {
    part.remove_prefix(1);
    radix = 8;
  }
  if (part.empty()) return 0;
  uint64_t v = 0;
  for (char c : part) {
    int d = isDigit(c) ? c - '0' : (c >= 'a' && c <= 'f') ? c - 'a' + 10 : (c >= 'A' && c <= 'F') ? c - 'A' + 10 : 99;
    if (d >= radix) return std::nullopt;
    v = v * radix + d;
    if (v > 0xffffffffull * 256) return std::nullopt;  // bien au-delà de toute IPv4
  }
  return v;
}

// « ends in a number » : le dernier libellé (un point final ignoré) est un nombre.
bool endsInNumber(const std::string& host) {
  std::string_view h = host;
  if (!h.empty() && h.back() == '.') h.remove_suffix(1);
  const size_t dot = h.rfind('.');
  std::string_view last = dot == std::string_view::npos ? h : h.substr(dot + 1);
  if (last.empty()) return false;
  bool digits = true;
  for (char c : last) digits = digits && isDigit(c);
  if (digits) return true;
  if (last.size() >= 2 && last[0] == '0' && (last[1] == 'x' || last[1] == 'X')) {
    for (char c : last.substr(2)) if (!isHex(c)) return false;
    return true;
  }
  return false;
}

std::optional<std::string> parseIpv4(std::string host) {
  std::vector<std::string> parts;
  size_t start = 0;
  for (size_t i = 0; i <= host.size(); ++i) {
    if (i == host.size() || host[i] == '.') {
      parts.push_back(host.substr(start, i - start));
      start = i + 1;
    }
  }
  if (parts.size() > 1 && parts.back().empty()) parts.pop_back();
  if (parts.size() > 4) return std::nullopt;
  std::vector<uint64_t> numbers;
  for (const std::string& p : parts) {
    if (p.empty()) return std::nullopt;
    auto n = ipv4Number(p);
    if (!n) return std::nullopt;
    numbers.push_back(*n);
  }
  for (size_t i = 0; i + 1 < numbers.size(); ++i) if (numbers[i] > 255) return std::nullopt;
  const uint64_t limit = 1ull << (8 * (5 - numbers.size()));
  if (numbers.back() >= limit) return std::nullopt;
  uint64_t v = numbers.back();
  for (size_t i = 0; i + 1 < numbers.size(); ++i) v += numbers[i] << (8 * (3 - i));
  return std::to_string(v >> 24) + "." + std::to_string((v >> 16) & 255) + "." +
         std::to_string((v >> 8) & 255) + "." + std::to_string(v & 255);
}

std::optional<std::string> parseHost(std::string_view raw) {
  if (raw.empty()) return std::nullopt;
  if (raw.front() == '[') {
    if (raw.back() != ']' || raw.size() < 3) return std::nullopt;
    for (char c : raw.substr(1, raw.size() - 2)) {
      if (!isHex(c) && c != ':' && c != '.') return std::nullopt;
    }
    return toLowerAscii(std::string(raw));
  }
  std::string host = toLowerAscii(percentDecodeBytes(raw));
  if (host.empty()) return std::nullopt;
  for (unsigned char c : host) if (forbiddenInDomain(c)) return std::nullopt;
  if (endsInNumber(host)) return parseIpv4(host);
  return host;
}

bool isSingleDot(const std::string& s) { return s == "." || toLowerAscii(s) == "%2e"; }
bool isDoubleDot(const std::string& s) {
  const std::string l = toLowerAscii(s);
  return l == ".." || l == ".%2e" || l == "%2e." || l == "%2e%2e";
}

// Jeu d'encodage du chemin : C0, espace, " # < > ? ` { }, et tout octet hors ASCII.
std::string encodePathSegment(const std::string& seg) {
  static constexpr char kHex[] = "0123456789ABCDEF";
  std::string out;
  for (unsigned char c : seg) {
    const bool encode = c < 0x21 || c > 0x7e || c == '"' || c == '#' || c == '<' || c == '>' ||
                        c == '?' || c == '`' || c == '{' || c == '}';
    if (encode) {
      out += '%';
      out += kHex[c >> 4];
      out += kHex[c & 15];
    } else {
      out += char(c);
    }
  }
  return out;
}

std::string parsePath(std::string_view raw) {
  // `raw` commence par « / » ou « \ » (ou est vide) ; les deux séparent les segments.
  std::vector<std::string> segments, out;
  if (!raw.empty()) {
    size_t start = 1;
    for (size_t i = 1; i <= raw.size(); ++i) {
      if (i == raw.size() || raw[i] == '/' || raw[i] == '\\') {
        segments.emplace_back(raw.substr(start, i - start));
        start = i + 1;
      }
    }
  }
  for (size_t k = 0; k < segments.size(); ++k) {
    const bool last = k + 1 == segments.size();
    if (isDoubleDot(segments[k])) {
      if (!out.empty()) out.pop_back();
      if (last) out.emplace_back();
    } else if (isSingleDot(segments[k])) {
      if (last) out.emplace_back();
    } else {
      out.push_back(encodePathSegment(segments[k]));
    }
  }
  std::string path;
  for (const std::string& s : out) path += "/" + s;
  return path.empty() ? "/" : path;
}

}  // namespace

std::string WebUrl::origin() const {
  return scheme + "://" + host + (port.empty() ? "" : ":" + port);
}

std::string WebUrl::href() const { return origin() + path + (query ? "?" + *query : ""); }

std::optional<WebUrl> parseHttpUrl(std::string_view input) {
  size_t b = 0, e = input.size();
  while (b < e && static_cast<unsigned char>(input[b]) <= 0x20) ++b;
  while (e > b && static_cast<unsigned char>(input[e - 1]) <= 0x20) --e;
  std::string s;
  for (size_t i = b; i < e; ++i) {
    if (input[i] != '\t' && input[i] != '\n' && input[i] != '\r') s += input[i];
  }
  const size_t colon = s.find(':');
  if (colon == std::string::npos || colon == 0 || !isAlpha(s[0])) return std::nullopt;
  for (size_t i = 1; i < colon; ++i) {
    const char c = s[i];
    if (!isAlpha(c) && !isDigit(c) && c != '+' && c != '-' && c != '.') return std::nullopt;
  }
  WebUrl url;
  url.scheme = toLowerAscii(s.substr(0, colon));
  if (url.scheme != "http" && url.scheme != "https") return std::nullopt;
  size_t i = colon + 1;
  while (i < s.size() && (s[i] == '/' || s[i] == '\\')) ++i;
  size_t authEnd = s.find_first_of("/\\?#", i);
  if (authEnd == std::string::npos) authEnd = s.size();
  std::string_view auth(s.data() + i, authEnd - i);
  if (const size_t at = auth.rfind('@'); at != std::string_view::npos) {
    const std::string_view info = auth.substr(0, at);
    const size_t sep = info.find(':');
    url.username = std::string(info.substr(0, sep));
    if (sep != std::string_view::npos) url.password = std::string(info.substr(sep + 1));
    auth.remove_prefix(at + 1);
  }
  std::string_view hostPart = auth, portPart;
  bool hasPort = false;
  const size_t close = auth.find(']');
  const size_t portSep = auth.find(':', auth.size() && auth[0] == '[' && close != std::string_view::npos ? close : 0);
  if (portSep != std::string_view::npos) {
    hostPart = auth.substr(0, portSep);
    portPart = auth.substr(portSep + 1);
    hasPort = true;
  }
  auto host = parseHost(hostPart);
  if (!host) return std::nullopt;
  url.host = *host;
  if (hasPort && !portPart.empty()) {
    uint32_t port = 0;
    for (char c : portPart) {
      if (!isDigit(c)) return std::nullopt;
      port = port * 10 + uint32_t(c - '0');
      if (port > 65535) return std::nullopt;
    }
    const uint32_t def = url.scheme == "https" ? 443 : 80;
    if (port != def) url.port = std::to_string(port);
  }
  size_t pathEnd = s.find_first_of("?#", authEnd);
  if (pathEnd == std::string::npos) pathEnd = s.size();
  url.path = parsePath(std::string_view(s).substr(authEnd, pathEnd - authEnd));
  if (pathEnd < s.size() && s[pathEnd] == '?') {
    const size_t hash = s.find('#', pathEnd);
    url.query = s.substr(pathEnd + 1, (hash == std::string::npos ? s.size() : hash) - pathEnd - 1);
  }
  return url;
}

}  // namespace tentacle::net
