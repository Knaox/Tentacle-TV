#pragma once
// Base64 standard (RFC 4648, avec `=`), tel que Node l'écrit et tel qu'Electron l'accepte
// (`/^[A-Za-z0-9+/]*={0,2}$/`, longueur multiple de 4).

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace tentacle::offline::base64 {

std::string encode(const std::vector<uint8_t>& bytes);

/// `nullopt` sur tout écart au base64 canonique (caractère hors alphabet, longueur, `=` mal
/// placé). Comme Electron : `=` seulement en fin, deux au plus.
std::optional<std::vector<uint8_t>> decodeStrict(const std::string& text);

}  // namespace tentacle::offline::base64
