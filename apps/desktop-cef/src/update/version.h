#pragma once
// Numéros de version « X.Y.Z[-pré] » (SemVer réduit) : lecture et comparaison.
// Une pré-version précède la version finale (1.2.0-beta.2 < 1.2.0), ses identifiants
// numériques se comparent en nombres, les autres en texte.

#include <optional>
#include <string>
#include <string_view>

namespace tentacle::update {

struct Version {
  int major = 0, minor = 0, patch = 0;
  std::string pre;  // vide : version finale

  static std::optional<Version> parse(std::string_view text);
  std::string str() const;
};

// < 0, 0 ou > 0, comme strcmp.
int compare(const Version& a, const Version& b);
inline bool operator<(const Version& a, const Version& b) { return compare(a, b) < 0; }
inline bool operator<=(const Version& a, const Version& b) { return compare(a, b) <= 0; }
inline bool operator>(const Version& a, const Version& b) { return compare(a, b) > 0; }
inline bool operator>=(const Version& a, const Version& b) { return compare(a, b) >= 0; }
inline bool operator==(const Version& a, const Version& b) { return compare(a, b) == 0; }

}  // namespace tentacle::update
