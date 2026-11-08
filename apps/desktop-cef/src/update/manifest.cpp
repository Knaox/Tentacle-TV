#include "update/manifest.h"

#include <nlohmann/json.hpp>

namespace tentacle::update {
namespace {

using Json = nlohmann::json;

void setError(std::string* error, std::string text) {
  if (error) *error = std::move(text);
}

std::string str(const Json& j, const char* key) {
  auto it = j.find(key);
  return (it != j.end() && it->is_string()) ? it->get<std::string>() : std::string();
}

Localized localized(const Json& j, const char* key) {
  Localized l;
  auto it = j.find(key);
  if (it == j.end()) return l;
  if (it->is_string()) {  // un seul texte : pour les deux langues
    l.fr = l.en = it->get<std::string>();
  } else if (it->is_object()) {
    l.fr = str(*it, "fr");
    l.en = str(*it, "en");
  }
  return l;
}

std::optional<Version> optionalVersion(const Json& j, const char* key, bool& bad) {
  const std::string text = str(j, key);
  if (text.empty()) return std::nullopt;
  auto v = Version::parse(text);
  if (!v) bad = true;
  return v;
}

// L'hôte d'une URL « schéma://hôte[:port]/… », sans les crochets d'IPv6.
std::string hostOf(std::string_view url, std::string_view& scheme) {
  const size_t sep = url.find("://");
  if (sep == std::string_view::npos) return {};
  scheme = url.substr(0, sep);
  std::string_view rest = url.substr(sep + 3);
  rest = rest.substr(0, rest.find_first_of("/?#"));
  if (rest.find('@') != std::string_view::npos) return {};  // pas d'identifiants dans l'URL
  if (!rest.empty() && rest[0] == '[') return std::string(rest.substr(1, rest.find(']') - 1));
  return std::string(rest.substr(0, rest.find(':')));
}

}  // namespace

const char* severityName(Severity s) {
  switch (s) {
    case Severity::Minor: return "minor";
    case Severity::Major: return "major";
    case Severity::Critical: return "critical";
  }
  return "minor";
}

bool isLoopbackUrl(std::string_view url) {
  std::string_view scheme;
  const std::string host = hostOf(url, scheme);
  return host == "127.0.0.1" || host == "::1" || host == "localhost";
}

bool acceptableUrl(std::string_view url, bool allowLoopbackHttp) {
  std::string_view scheme;
  const std::string host = hostOf(url, scheme);
  if (host.empty()) return false;
  if (scheme == "https") return true;
  return scheme == "http" && allowLoopbackHttp && isLoopbackUrl(url);
}

std::optional<std::string> openEnvelope(std::string_view envelope, const std::vector<TrustedKey>& keys,
                                        std::string* error) {
  const Json j = Json::parse(envelope, nullptr, false);
  if (j.is_discarded() || !j.is_object()) return setError(error, "enveloppe illisible"), std::nullopt;
  // Accès TYPÉS seulement : `value()` lève une exception sur un type inattendu (« "1" »).
  const auto format = j.find("format");
  if (format == j.end() || !format->is_number_integer() || format->get<int64_t>() != 1)
    return setError(error, "format d'enveloppe inconnu"), std::nullopt;
  const std::string keyId = str(j, "keyId");
  const std::string manifest = str(j, "manifest");
  const auto signature = base64Decode(str(j, "signature"));
  if (manifest.empty() || !signature) return setError(error, "enveloppe incomplète"), std::nullopt;
  for (const auto& k : keys) {
    if (k.id != keyId) continue;
    if (verifyEd25519(k.key, manifest, *signature)) return manifest;
    return setError(error, "signature invalide"), std::nullopt;
  }
  return setError(error, "clé inconnue : " + keyId), std::nullopt;
}

std::optional<Manifest> parseManifest(std::string_view json, std::string* error) {
  const Json j = Json::parse(json, nullptr, false);
  if (j.is_discarded() || !j.is_object()) return setError(error, "manifeste illisible"), std::nullopt;
  Manifest m;
  auto version = Version::parse(str(j, "version"));
  if (!version) return setError(error, "version absente ou invalide"), std::nullopt;
  m.version = *version;
  m.channel = str(j, "channel");
  if (m.channel.empty()) return setError(error, "canal absent"), std::nullopt;
  const std::string sev = str(j, "severity");
  if (sev == "minor") m.severity = Severity::Minor;
  else if (sev == "major") m.severity = Severity::Major;
  else if (sev == "critical") m.severity = Severity::Critical;
  else return setError(error, "gravité inconnue : " + sev), std::nullopt;
  bool bad = false;
  m.minVersion = optionalVersion(j, "minVersion", bad);
  m.majorSince = optionalVersion(j, "majorSince", bad);
  if (bad) return setError(error, "minVersion ou majorSince invalide"), std::nullopt;
  if (m.majorSince && *m.majorSince > m.version) return setError(error, "majorSince après version"), std::nullopt;
  m.notes = localized(j, "notes");
  m.reason = localized(j, "reason");
  m.notesUrl = str(j, "notesUrl");
  if (!m.notesUrl.empty() && !acceptableUrl(m.notesUrl, true)) m.notesUrl.clear();
  if (auto it = j.find("issuedAt"); it != j.end() && it->is_number_integer()) m.issuedAt = it->get<int64_t>();
  if (auto it = j.find("assets"); it != j.end() && it->is_object()) {
    for (auto& [key, a] : it->items()) {
      if (!a.is_object()) continue;
      Asset asset{str(a, "url"), str(a, "sha256"), 0};
      if (auto s = a.find("size"); s != a.end() && s->is_number_unsigned()) asset.size = s->get<uint64_t>();
      if (asset.url.empty() || !isSha256Hex(asset.sha256))
        return setError(error, "archive « " + key + " » sans URL ou sans SHA-256"), std::nullopt;
      m.assets.emplace(key, std::move(asset));
    }
  }
  return m;
}

}  // namespace tentacle::update
