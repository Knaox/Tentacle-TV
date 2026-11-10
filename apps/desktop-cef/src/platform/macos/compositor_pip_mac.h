#pragma once
// macOS : la fenêtre PiP native (pièces internes de src/platform/macos/compositor_pip*).
//
// Une NSWindow à nous, PAS une fenêtre SDL : AppKit y donne ce qu'Electron obtient de Chromium
// et que SDL3 ne laisse pas régler fenêtre par fenêtre —
//  - le premier clic d'une fenêtre inactive va au bouton visé (`acceptsFirstMouse`) ;
//  - le survol arrive même application inactive (zone de suivi « ActiveAlways ») : plus de
//    relais du curseur comme `pipDocking.ts` ;
//  - le redimensionnement par les bords passe par le délégué (ratio, bornes, coin ancré :
//    `pipResizeGuard.ts`) ;
//  - aucun aiguillage d'évènements dans la boucle SDL : la page du PiP reçoit sa souris d'ici.

#ifdef __OBJC__
#import <Cocoa/Cocoa.h>
#endif

#include "pip/pip_ports.h"

#ifdef __OBJC__

/// La vue de contenu du PiP : la souris de la fenêtre, transmise à sa page.
@interface TentaclePipView : NSView
- (instancetype)initWithFrame:(NSRect)frame input:(tentacle::pip::PageInput)input;
/// Le curseur demandé par la page (type `cef_cursor_type_t`).
- (void)setCefCursor:(int)type;
/// Coupe la transmission (la page part).
- (void)detach;
@end

namespace tentacle::pip::mac {

/// Coordonnées : AppKit (origine en bas à gauche de l'écran principal) ↔ les nôtres.
NSRect toAppKit(const Box& box);
Box fromAppKit(NSRect rect);

/// La fenêtre PiP native ; `host` : la fenêtre principale (ancrage, focus).
std::unique_ptr<Window> createWindow(NSWindow* host, const Box& box, Mode mode,
                                     const std::string& caption, PageInput input);
/// Le curseur de la page au-dessus de cette fenêtre (type `cef_cursor_type_t`).
void setWindowCursor(Window& window, int type);

}  // namespace tentacle::pip::mac

#endif
