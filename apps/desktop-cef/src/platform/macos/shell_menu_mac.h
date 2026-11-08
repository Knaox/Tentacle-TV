#pragma once
// macOS seulement : appelé par -[TentacleApplication sendEvent:] (app_mac.mm). Retient un
// raccourci ⌘/⌃ destiné à notre fenêtre au lieu de le livrer aux menus ; il leur sera rendu
// par dispatchUnhandledKey si la page ne le consomme pas. Vrai = évènement retenu.

#import <Cocoa/Cocoa.h>

namespace tentacle::platform {
bool holdKeyEquivalent(NSEvent* event);
}
