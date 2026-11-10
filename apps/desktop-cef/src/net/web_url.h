#pragma once
// Les adresses comme le front et Node les voient — règle PURE, sans CEF, pour que les clés
// et les décisions soient celles d'Electron à l'octet près (la clé d'une pochette nomme un
// fichier qu'Electron relit).
//
//  - `parseHttpUrl` : l'analyseur d'URL du WHATWG (`new URL(…)`), pour http(s) seulement —
//    espaces et tabulations retirés, schéma et hôte en minuscules, port par défaut retiré,
//    IPv4 normalisée, segments « . » et « .. » résolus, chemin encodé comme `url.pathname`.
//    Écarts assumés (rares, écrits ici) : un hôte non ASCII n'est pas converti en punycode,
//    une IPv6 n'est pas réécrite sous sa forme compacte.
//  - `parseFormQuery` : `URLSearchParams` (application/x-www-form-urlencoded, « + » = espace,
//    UTF-8 invalide → U+FFFD) ; `encodeUriComponent` : celui de JavaScript.
//  - `localeCompare` : `String.prototype.localeCompare` (collation racine d'ICU) pour
//    l'ASCII — ponctuation < chiffres < lettres, minuscule avant majuscule à égalité ; hors
//    ASCII, l'ordre des points de code (approximation).

#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace tentacle::net {

struct WebUrl {
  std::string scheme;    // "http" | "https"
  std::string username;  // tel qu'écrit (seul son vide compte)
  std::string password;
  std::string host;      // minuscules ; IPv6 entre crochets
  std::string port;      // vide : absent ou port par défaut du schéma
  std::string path;      // `url.pathname`, encodé, commence par « / »
  std::optional<std::string> query;     // sans le « ? », tel qu'écrit
  std::optional<std::string> fragment;  // sans le « # », tel qu'écrit
  std::string origin() const;           // `url.origin`
  /// `url.href` sans identifiants : requête et fragment encodés comme le WHATWG.
  std::string href() const;
};

/// `new URL(input)` pour http(s) ; nullopt si l'adresse est invalide OU d'un autre schéma.
std::optional<WebUrl> parseHttpUrl(std::string_view input);

using FormParams = std::vector<std::pair<std::string, std::string>>;
FormParams parseFormQuery(std::string_view query);
/// `URLSearchParams.get(name)` : la première valeur, nullopt si le nom est absent.
std::optional<std::string> formParam(const FormParams& params, std::string_view name);

std::string encodeUriComponent(std::string_view utf8);
/// Octets → UTF-8 valide (chaque sous-partie invalide maximale devient U+FFFD).
std::string sanitizeUtf8(std::string_view bytes);
/// `%XX` → octet ; une séquence invalide reste telle quelle.
std::string percentDecodeBytes(std::string_view s);
std::string toLowerAscii(std::string s);

/// < 0, 0, > 0 comme `a.localeCompare(b)`.
int localeCompare(std::string_view a, std::string_view b);

}  // namespace tentacle::net
