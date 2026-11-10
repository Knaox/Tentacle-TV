#pragma once
// L'instantané du verre natif, pour le banc (`snapshot.ts` d'Electron) : il relit les VRAIES
// vues d'AppKit — « aucune région native quand le réglage est coupé » se prouve par ce que la
// fenêtre porte, pas par ce que le gestionnaire croit. Canal `liquidGlass.debug.snapshot`.

#include <optional>

#include <nlohmann/json.hpp>

#include "glass/backend.h"

namespace tentacle::glass {

nlohmann::json rectJson(const Rect& rect);
/// `{frame, containerAlpha}` ou `null`.
nlohmann::json liveJson(const std::optional<GlassInspection::Live>& live);
/// Une région : ce que la page a demandé (`css`, px CSS), et ce qu'AppKit porte (`frame`,
/// points, origine en BAS ; `null` sans vue).
nlohmann::json describeRegion(const Region& region, const std::optional<GlassInspection>& native);

}  // namespace tentacle::glass
