#pragma once
// Commandes de `window.tentacle` propres à Linux (session graphique). À déclarer entre
// pont::install et pont::installShim (src/app/modules.cpp, ligne `#ifdef __linux__`).

namespace bridge {
class Registry;
}

namespace tentacle::platform {

void installLinuxCommands(bridge::Registry& registry);
// Presse-papiers du système pour la page hors écran (clipboard_linux.cpp) ; appelé par la
// précédente, avant la création du navigateur (script injecté).
void installClipboardBridge();

}  // namespace tentacle::platform
