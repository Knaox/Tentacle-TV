// Linux : l'état HDR de l'écran (platform/display_hdr.h). Rien à basculer : sous Wayland le
// compositeur alloue l'espace colorimétrique surface par surface, X11 n'a rien. Electron y
// répond par ce que mpv SORT (`linux/hdr.ts`, video-target-params) : à reprendre par l'axe
// linux s'il le faut — posé par l'axe windows avec les réponses « rien constaté ».

#include "display/display_channels.h"
#include "platform/display_hdr.h"

namespace tentacle::platform {

DisplayHdrProbe probeDisplayHdr(void*) { return {}; }
bool displayHdrNegotiated() { return false; }
bool enableDisplayHdr() { return false; }
void restoreDisplayHdr() {}
bool displayHdrToggled() { return false; }

// Aucune commande propre à l'OS ici (Windows : le Microsoft Store, os_commands_windows.cpp).
void installOsCommands(AppContext&, bridge::Registry&) {}
void shutdownOsCommands() {}

}  // namespace tentacle::platform
