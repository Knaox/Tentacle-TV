// La règle des requêtes déléguées (voir client_fetch_policy.h).

#include "net/client_fetch_policy.h"

#include <algorithm>
#include <regex>
#include <set>

namespace tentacle::net::cf {
namespace {

bool isLabel(const std::string& l) {
  // /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
  if (l.empty() || l.size() > 63 || l.front() == '-' || l.back() == '-') return false;
  return std::all_of(l.begin(), l.end(), [](char c) { return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-'; });
}

std::vector<std::string> split(const std::string& s, char sep) {
  std::vector<std::string> out;
  size_t start = 0;
  for (size_t i = 0; i <= s.size(); ++i) {
    if (i == s.size() || s[i] == sep) {
      out.push_back(s.substr(start, i - start));
      start = i + 1;
    }
  }
  return out;
}

std::optional<std::vector<std::string>> hostList(const Json* value, bool wildcard) {
  if (!value) return std::vector<std::string>{};
  if (!value->is_array() || value->size() > limits::maxHosts) return std::nullopt;
  std::vector<std::string> out;
  for (const Json& v : *value) {
    if (!v.is_string()) return std::nullopt;
    const std::string s = v.get<std::string>();
    const std::string bare = wildcard && s.rfind("*.", 0) == 0 ? s.substr(2) : s;
    if (!isDeclarableHost(bare)) return std::nullopt;
    if (std::find(out.begin(), out.end(), s) == out.end()) out.push_back(s);  // [...new Set(out)]
  }
  return out;
}

bool v4Parts(const std::string& ip, int out[4]) {
  const auto parts = split(ip, '.');
  if (parts.size() != 4) return false;
  for (int i = 0; i < 4; ++i) {
    const std::string& p = parts[i];
    if (p.empty() || p.size() > 3 || (p.size() > 1 && p[0] == '0')) return false;
    if (!std::all_of(p.begin(), p.end(), [](char c) { return c >= '0' && c <= '9'; })) return false;
    out[i] = std::stoi(p);
    if (out[i] > 255) return false;
  }
  return true;
}

bool v4Private(const int p[4]) {
  const int a = p[0], b = p[1];
  return a == 0 || a == 10 || a == 127 || a >= 224 || (a == 100 && b >= 64 && b <= 127) ||
         (a == 169 && b == 254) || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168) ||
         (a == 198 && (b == 18 || b == 19));
}

bool looksIpv6(const std::string& ip) {
  if (ip.find(':') == std::string::npos) return false;
  for (char c : ip) {
    const bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') || c == ':' || c == '.';
    if (!ok) return false;
  }
  const size_t dbl = ip.find("::");
  return dbl == std::string::npos || ip.find("::", dbl + 1) == std::string::npos;
}

bool utf8ByteLimit(const std::string& s, size_t max) { return s.size() <= max; }

bool isIntegerIn(const Json& v, int64_t max) {
  if (!v.is_number()) return false;
  const double d = v.get<double>();
  return d == double(int64_t(d)) && d > 0 && d <= double(max);
}

}  // namespace

bool isDeclarableHost(const std::string& host) {
  if (host.size() > 253 || host != toLowerAscii(host)) return false;
  const auto labels = split(host, '.');
  if (labels.size() < 2 || !std::all_of(labels.begin(), labels.end(), isLabel)) return false;
  const std::string& last = labels.back();
  if (std::all_of(last.begin(), last.end(), [](char c) { return c >= '0' && c <= '9'; })) return false;
  static const std::regex local("(^|\\.)(localhost|local|internal|lan|home|arpa|test|invalid)$");
  return !std::regex_search(host, local);
}

std::optional<Manifest> readManifest(const Json& raw) {
  if (!raw.is_object()) return std::nullopt;
  const auto field = [&](const char* k) -> const Json* {
    auto it = raw.find(k);
    return it == raw.end() ? nullptr : &*it;
  };
  auto hosts = hostList(field("hosts"), false);
  auto mediaHosts = hostList(field("mediaHosts"), true);
  if (!hosts || !mediaHosts || hosts->empty()) return std::nullopt;
  return Manifest{*hosts, *mediaHosts};
}

bool hostAllowed(const std::string& host, const std::vector<std::string>& patterns) {
  const std::string h = toLowerAscii(host);
  return std::any_of(patterns.begin(), patterns.end(), [&](const std::string& p) {
    if (p.rfind("*.", 0) == 0) return h.size() > p.size() - 1 && h.ends_with(p.substr(1));
    return h == p;
  });
}

std::optional<WebUrl> allowedUrl(const std::string& raw, const std::vector<std::string>& patterns) {
  auto url = parseHttpUrl(raw);
  if (!url || url->scheme != "https" || !url->username.empty() || !url->password.empty() || !url->port.empty()) {
    return std::nullopt;
  }
  return hostAllowed(url->host, patterns) ? url : std::nullopt;
}

std::optional<std::string> checkRequest(const Json& r, const Manifest& manifest) {
  if (!r.is_object()) return "requête absente";
  const auto get = [&](const char* k) -> const Json* {
    auto it = r.find(k);
    return it == r.end() ? nullptr : &*it;
  };
  const Json* method = get("method");
  if (!method || !method->is_string() || (*method != "GET" && *method != "POST")) return "méthode refusée";
  const Json* url = get("url");
  if (!url || !url->is_string() || url->get<std::string>().size() > 4096 || !allowedUrl(url->get<std::string>(), manifest.hosts)) {
    return "adresse hors des hôtes déclarés";
  }
  if (const Json* body = get("body"); body && (!body->is_string() || *method != "POST" || !utf8ByteLimit(body->get<std::string>(), limits::maxRequestBody))) {
    return "corps refusé";
  }
  if (const Json* t = get("timeoutMs"); t && !isIntegerIn(*t, limits::maxTimeoutMs)) return "délai refusé";
  if (const Json* m = get("maxBytes"); m && !isIntegerIn(*m, limits::maxResponseBytes)) return "taille refusée";
  const Json* kind = get("kind");
  if (kind && *kind != "play" && *kind != "prefetch") return "nature refusée";
  if (const Json* burst = get("burst"); burst && (!burst->is_boolean() || (burst->get<bool>() && (!kind || *kind != "prefetch")))) {
    return "rafale refusée";
  }
  if (const Json* headers = get("headers")) {
    if (!headers->is_object()) return "en-têtes refusés";
    if (headers->size() > limits::maxHeaders) return "trop d'en-têtes";
    static const std::regex name("^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$");
    static const std::regex forbidden(
        "^(cookie|cookie2|authorization|proxy-.*|host|connection|keep-alive|content-length|transfer-encoding|te|"
        "trailer|upgrade|expect|sec-.*|x-tentacle-.*|x-emby-.*|x-mediabrowser-.*|x-forwarded-.*|forwarded|"
        "x-real-ip|via)$",
        std::regex::icase);
    size_t bytes = 0;
    for (auto it = headers->begin(); it != headers->end(); ++it) {
      if (!std::regex_match(it.key(), name) || std::regex_match(it.key(), forbidden)) {
        return "en-tête interdit : " + it.key().substr(0, 64);
      }
      if (!it->is_string() || it->get<std::string>().find_first_of(std::string("\r\n\0", 3)) != std::string::npos) {
        return "valeur d'en-tête refusée";
      }
      bytes += it.key().size() + it->get<std::string>().size();
    }
    if (bytes > limits::maxHeaderBytes) return "en-têtes trop longs";
  }
  return std::nullopt;
}

bool isPrivateAddress(const std::string& ip) {
  int p[4];
  if (v4Parts(ip, p)) return v4Private(p);
  if (!looksIpv6(ip)) return true;
  const std::string low = toLowerAscii(ip);
  if (low.rfind("::ffff:", 0) == 0 && v4Parts(low.substr(7), p)) return v4Private(p);
  static const std::regex special("^(f[cd]|fe[89ab]|ff)");
  return low == "::" || low == "::1" || std::regex_search(low, special) || low.rfind("64:ff9b:", 0) == 0 ||
         low.rfind("2001:db8:", 0) == 0;
}

std::optional<WebUrl> resolveUrl(const WebUrl& base, const std::string& ref) {
  // Un schéma : adresse absolue.
  const size_t colon = ref.find(':');
  const size_t firstSep = ref.find_first_of("/?#");
  if (colon != std::string::npos && (firstSep == std::string::npos || colon < firstSep) && colon > 0) {
    return parseHttpUrl(ref);
  }
  const std::string origin = base.origin();
  if (ref.rfind("//", 0) == 0 || ref.rfind("\\\\", 0) == 0) return parseHttpUrl(base.scheme + ":" + ref);
  if (!ref.empty() && (ref[0] == '/' || ref[0] == '\\')) return parseHttpUrl(origin + ref);
  if (!ref.empty() && ref[0] == '?') return parseHttpUrl(origin + base.path + ref);
  if (ref.empty() || ref[0] == '#') return parseHttpUrl(base.href() + ref);
  const std::string dir = base.path.substr(0, base.path.rfind('/') + 1);
  return parseHttpUrl(origin + dir + ref);
}

}  // namespace tentacle::net::cf
