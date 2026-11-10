#pragma once
// Les types servis sous tentacle://local — liste FERMÉE de `localAssets.ts` : un média ne
// passe JAMAIS par la page (mpv le lit depuis son chemin absolu).

#include <optional>
#include <string>

namespace tentacle::offline {

/// Le type de ce chemin relatif (`path.extname` en minuscules), ou rien : 404.
std::optional<std::string> localAssetMime(const std::string& rel);

}  // namespace tentacle::offline
