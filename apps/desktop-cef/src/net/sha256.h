#pragma once
// SHA-256 (FIPS 180-4) et ses écritures hexadécimale et base64 — sans dépendance, pour les
// trois OS. Sert à nommer les fichiers du cache des pochettes comme Electron
// (`createHash("sha256")…digest("hex")`) et aux empreintes de la CSP (`…digest("base64")`).

#include <array>
#include <cstdint>
#include <string>
#include <string_view>

namespace tentacle::net {

using Digest = std::array<uint8_t, 32>;

Digest sha256(std::string_view data);
/// Hexadécimal en minuscules, comme `digest("hex")` de Node.
std::string toHex(const Digest& d);
/// Base64 standard avec remplissage, comme `digest("base64")` de Node.
std::string toBase64(std::string_view bytes);
inline std::string sha256Hex(std::string_view data) { return toHex(sha256(data)); }

}  // namespace tentacle::net
