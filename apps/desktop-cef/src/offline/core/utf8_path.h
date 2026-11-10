#pragma once
// Chemins ↔ UTF-8, sur les trois systèmes.
//
// La page, la base et mpv parlent en UTF-8 ; `std::filesystem::path` est en caractères
// larges sous Windows. `path::string()` y passerait par la page de code ANSI et perdrait
// tout ce qui n'y tient pas (un dossier « Vidéos », un prénom) : on passe TOUJOURS par
// `u8string()` et par un `path` construit depuis `char8_t`.

#include <filesystem>
#include <string>

namespace tentacle::offline {

inline std::string pathToUtf8(const std::filesystem::path& path) {
  const std::u8string u8 = path.u8string();
  return std::string(u8.begin(), u8.end());
}

inline std::filesystem::path utf8ToPath(const std::string& text) {
  return std::filesystem::path(std::u8string(text.begin(), text.end()));
}

}  // namespace tentacle::offline
