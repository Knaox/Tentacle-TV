// macOS : l'état HDR de l'écran (platform/display_hdr.h), comme `video/macosEdr.ts` d'Electron.
// Rien à basculer ni à rendre : l'EDR est accordé fenêtre par fenêtre par le compositeur.

#import <AppKit/AppKit.h>

#include "display/display_channels.h"
#include "platform/display_hdr.h"

namespace tentacle::platform {

DisplayHdrProbe probeDisplayHdr(void* nativeWindow) {
  DisplayHdrProbe p;
  NSWindow* window = (__bridge NSWindow*)nativeWindow;
  NSScreen* screen = window.screen ?: NSScreen.mainScreen;
  if (!screen) return p;
  // Marge de 1 % (macosEdr.ts) : la valeur est un flottant du compositeur, 1,0000001 ne
  // veut rien dire à l'écran.
  p.active = screen.maximumExtendedDynamicRangeColorComponentValue > 1.01;
  p.edrCapable = screen.maximumPotentialExtendedDynamicRangeColorComponentValue > 1.01;
  return p;  // supported : faux — l'option de bascule n'a pas de sens ici
}

bool displayHdrNegotiated() { return false; }
bool enableDisplayHdr() { return false; }
void restoreDisplayHdr() {}
bool displayHdrToggled() { return false; }

// Aucune commande propre à l'OS ici (Windows : le Microsoft Store, os_commands_windows.cpp).
void installOsCommands(AppContext&, bridge::Registry&) {}
void shutdownOsCommands() {}

}  // namespace tentacle::platform
