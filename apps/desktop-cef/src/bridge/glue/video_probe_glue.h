// `video_surface_probe` et `video_edr_probe` (Electron : `ipc/videoProbe.ts`) — macOS, build de
// DÉVELOPPEMENT seulement (le paquet livré ne les déclare pas, comme `!app.isPackaged`).
#pragma once

#include <functional>

#include "ports.h"

namespace bridge {
class Registry;
}

namespace tentacle::pont {

// `surface` : l'état de la couche vidéo (`MpvPlayerPort::surfaceState`), `null` sans vidéo.
void installVideoProbes(bridge::Registry& registry, void* nsWindow, std::function<bridge::Json()> surface);

}  // namespace tentacle::pont
