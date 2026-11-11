// Politiques de sécurité du contenu (voir csp.h et csp.ts).

#include "net/csp.h"

#include <cctype>

#include "net/sha256.h"

namespace tentacle::net::csp {
namespace {

size_t findNoCase(std::string_view hay, std::string_view needle, size_t from) {
  if (needle.empty() || hay.size() < needle.size()) return std::string_view::npos;
  for (size_t i = from; i + needle.size() <= hay.size(); ++i) {
    size_t k = 0;
    while (k < needle.size() &&
           std::tolower(static_cast<unsigned char>(hay[i + k])) == static_cast<unsigned char>(needle[k])) {
      ++k;
    }
    if (k == needle.size()) return i;
  }
  return std::string_view::npos;
}

bool isJsWhitespace(unsigned char c) { return c == ' ' || (c >= 0x09 && c <= 0x0d); }

std::string join(const std::vector<std::string>& parts, const char* sep) {
  std::string out;
  for (const std::string& p : parts) {
    if (!out.empty()) out += sep;
    out += p;
  }
  return out;
}

}  // namespace

std::vector<std::string> inlineScriptHashes(std::string_view html) {
  // /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi
  std::vector<std::string> hashes;
  size_t at = 0;
  while ((at = findNoCase(html, "<script", at)) != std::string_view::npos) {
    const size_t tagEnd = html.find('>', at + 7);
    if (tagEnd == std::string_view::npos) break;
    const std::string_view attrs = html.substr(at + 7, tagEnd - at - 7);
    bool hasSrc = false;
    for (size_t s = findNoCase(attrs, "src=", 0); s != std::string_view::npos; s = findNoCase(attrs, "src=", s + 1)) {
      if (s > 0 && isJsWhitespace(static_cast<unsigned char>(attrs[s - 1]))) hasSrc = true;
    }
    const size_t close = findNoCase(html, "</script>", tagEnd + 1);
    if (hasSrc || close == std::string_view::npos) {
      at += 7;
      continue;
    }
    const std::string_view body = html.substr(tagEnd + 1, close - tagEnd - 1);
    bool blank = true;
    for (unsigned char c : body) blank = blank && isJsWhitespace(c);
    if (!blank) hashes.push_back("'sha256-" + toBase64(std::string_view(
                                     reinterpret_cast<const char*>(sha256(body).data()), 32)) + "'");
    at = close + 9;
  }
  return hashes;
}

std::string stripCspMeta(std::string_view html) {
  // /\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, en un peu plus large : toutes
  // les balises, l'attribut à n'importe quelle place, guillemets simples, doubles ou aucun.
  std::string out;
  out.reserve(html.size());
  size_t copied = 0;
  for (size_t at = findNoCase(html, "<meta", 0); at != std::string_view::npos;
       at = findNoCase(html, "<meta", at + 5)) {
    if (at + 5 < html.size() && !isJsWhitespace(static_cast<unsigned char>(html[at + 5]))) continue;
    const size_t tagEnd = html.find('>', at);
    if (tagEnd == std::string_view::npos) break;
    const std::string_view tag = html.substr(at, tagEnd - at);
    bool isCsp = false;
    for (size_t e = findNoCase(tag, "http-equiv", 0); e != std::string_view::npos && !isCsp;
         e = findNoCase(tag, "http-equiv", e + 10)) {
      size_t v = e + 10;
      while (v < tag.size() && isJsWhitespace(static_cast<unsigned char>(tag[v]))) ++v;
      if (v >= tag.size() || tag[v] != '=') continue;
      ++v;
      while (v < tag.size() && isJsWhitespace(static_cast<unsigned char>(tag[v]))) ++v;
      const char quote = v < tag.size() && (tag[v] == '"' || tag[v] == '\'') ? tag[v] : '\0';
      if (quote) ++v;
      constexpr std::string_view kName = "content-security-policy";
      if (findNoCase(tag.substr(v), kName, 0) != 0) continue;
      const size_t after = v + kName.size();
      // Le nom ENTIER : « …-Report-Only » n'est pas la politique (et la balise l'ignore).
      isCsp = after >= tag.size() || (quote ? tag[after] == quote
                                            : isJsWhitespace(static_cast<unsigned char>(tag[after])) || tag[after] == '/');
    }
    if (!isCsp) continue;
    size_t start = at;
    while (start > copied && isJsWhitespace(static_cast<unsigned char>(html[start - 1]))) --start;
    out.append(html.substr(copied, start - copied));
    copied = tagEnd + 1;
    at = tagEnd + 1 - 5;  // la boucle reprend après la balise retirée
  }
  out.append(html.substr(copied));
  return out;
}

std::string buildAppCsp(const std::string& appOrigin, const std::string& pluginOrigin,
                        const std::string& localOrigins, const std::vector<std::string>& scriptHashes) {
  std::vector<std::string> scriptSrc = {"'self'", appOrigin};
  scriptSrc.insert(scriptSrc.end(), scriptHashes.begin(), scriptHashes.end());
  return join({
                  "default-src 'self' " + appOrigin,
                  "script-src " + join(scriptSrc, " "),
                  "style-src 'self' 'unsafe-inline' " + appOrigin + " https://fonts.googleapis.com",
                  "font-src 'self' data: https://fonts.gstatic.com",
                  "img-src 'self' " + localOrigins + " data: blob: https: http:",
                  "media-src 'self' blob: data: https: http:",
                  "connect-src 'self' " + localOrigins + " https: http: ws: wss:",
                  "frame-src 'self' " + pluginOrigin + " blob: https: http:",
                  "worker-src 'self' blob:",
                  "object-src 'none'",
                  "base-uri 'self'",
                  "form-action 'self'",
                  "frame-ancestors 'none'",
              },
              "; ");
}

std::string buildPluginCsp(const std::string& appOrigin) {
  return join({
                  "default-src 'none'",
                  "script-src 'unsafe-inline' 'unsafe-eval'",
                  "style-src 'unsafe-inline'",
                  "img-src data: blob: https: http:",
                  "font-src data: https: http:",
                  "media-src blob: data: https: http:",
                  "connect-src https: http: ws: wss:",
                  "frame-src 'none'",
                  "object-src 'none'",
                  "base-uri 'none'",
                  "form-action 'none'",
                  "frame-ancestors " + appOrigin,
              },
              "; ");
}

}  // namespace tentacle::net::csp
