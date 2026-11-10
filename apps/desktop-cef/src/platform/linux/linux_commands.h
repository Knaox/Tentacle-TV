#pragma once
// Commandes de `window.tentacle` propres à Linux (session graphique). À déclarer entre
// pont::install et pont::installShim (src/app/modules.cpp, ligne `#ifdef __linux__`).

namespace bridge {
class Registry;
}

namespace tentacle::platform {

void installLinuxCommands(bridge::Registry& registry);

}  // namespace tentacle::platform
