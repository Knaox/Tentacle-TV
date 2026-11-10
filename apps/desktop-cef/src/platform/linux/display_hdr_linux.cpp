// Linux : l'état HDR de l'écran (platform/display_hdr.h). Rien à basculer : sous Wayland le
// compositeur alloue l'espace colorimétrique surface par surface, X11 n'a rien. Comme Electron
// (`linux/hdr.ts`), `display_hdr_state` répond par ce que mpv SORT : le relevé du couple
// video-params / video-target-params (src/display/output_reading.h), pas par cette sonde.

#include "display/display_channels.h"
#include "platform/display_hdr.h"
#include "platform/linux/linux_commands.h"

namespace tentacle::platform {

DisplayHdrProbe probeDisplayHdr(void*) { return {}; }
bool displayHdrNegotiated() { return false; }
bool enableDisplayHdr() { return false; }
void restoreDisplayHdr() {}
bool displayHdrToggled() { return false; }

// Les commandes propres à Linux (session graphique : linux_commands.cpp, axe linux) ; Windows
// y met le Microsoft Store (os_commands_windows.cpp).
void installOsCommands(AppContext&, bridge::Registry& reg) { installLinuxCommands(reg); }
void shutdownOsCommands() {}

}  // namespace tentacle::platform
