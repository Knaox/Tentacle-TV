// macOS : barre de menus du bureau Electron 1.42.0 (menu.ts : rôles about, services, hide,
// hideOthers, unhide, quit ; editMenu ; windowMenu) et renvoi des raccourcis non consommés
// par la page vers ces menus (shell/app_menu.h).

#import <Cocoa/Cocoa.h>

#include <deque>
#include <utility>

#include "include/internal/cef_types.h"
#include "platform/macos/shell_menu_mac.h"
#include "shell/app_menu.h"

using tentacle::platform::EditCommand;

namespace {
std::function<void(EditCommand)> g_edit;
bool g_pageFirst = false;
// Raccourcis ⌘/⌃ retenus le temps que la page les voie : (keyCode, NSEvent d'origine).
std::deque<std::pair<unsigned short, NSEvent*>> g_held;
constexpr size_t kMaxHeld = 8;
}  // namespace

// Cible des éléments d'édition : les commandes vont au cadre CEF actif (en hors écran, la vue
// de SDL3 est le premier répondeur et ne connaît pas copy:).
@interface TentacleEditTarget : NSObject
@end
@implementation TentacleEditTarget
- (void)run:(NSMenuItem*)item {
  if (g_edit) g_edit(EditCommand(item.tag));
}
@end

namespace {
TentacleEditTarget* g_target = nil;

NSMenuItem* item(NSMenu* menu, NSString* title, SEL action, NSString* key,
                 NSEventModifierFlags mods = NSEventModifierFlagCommand) {
  NSMenuItem* it = [menu addItemWithTitle:title action:action keyEquivalent:key];
  it.keyEquivalentModifierMask = mods;
  return it;
}

void editItem(NSMenu* menu, NSString* title, EditCommand cmd, NSString* key,
              NSEventModifierFlags mods = NSEventModifierFlagCommand) {
  NSMenuItem* it = item(menu, title, @selector(run:), key, mods);
  it.target = g_target;
  it.tag = NSInteger(cmd);
}

NSMenu* submenu(NSMenu* bar, NSString* title) {
  NSMenuItem* top = [bar addItemWithTitle:title action:nil keyEquivalent:@""];
  NSMenu* m = [[NSMenu alloc] initWithTitle:title];
  top.submenu = m;
  return m;
}
}  // namespace

namespace tentacle::platform {

bool holdKeyEquivalent(NSEvent* event) {
  if (!g_pageFirst || event.type != NSEventTypeKeyDown) return false;
  if (!(event.modifierFlags & (NSEventModifierFlagCommand | NSEventModifierFlagControl))) return false;
  if (!event.window || event.window != NSApp.keyWindow) return false;
  if (g_held.size() >= kMaxHeld) g_held.pop_front();  // consommés par la page : jamais rendus
  g_held.emplace_back(event.keyCode, event);
  return true;
}

void setPageReceivesShortcuts(bool on) {
  g_pageFirst = on;
  if (!on) g_held.clear();
}

bool dispatchUnhandledKey(int nativeKeyCode, uint32_t cefModifiers) {
  if (!(cefModifiers & (EVENTFLAG_COMMAND_DOWN | EVENTFLAG_CONTROL_DOWN))) return false;
  // Le plus ancien appui de cette touche : la page répond dans l'ordre des évènements.
  for (auto it = g_held.begin(); it != g_held.end(); ++it) {
    if (it->first != nativeKeyCode) continue;
    NSEvent* e = it->second;
    g_held.erase(g_held.begin(), it + 1);  // les précédents ont été consommés par la page
    return [NSApp.mainMenu performKeyEquivalent:e];
  }
  return false;
}

void installAppMenu(std::function<void(EditCommand)> edit) {
  g_edit = std::move(edit);
  g_target = [TentacleEditTarget new];
  // Le plein écran est un élément explicite du menu Fenêtre (⌃⌘F) : AppKit n'en ajoute pas.
  [NSUserDefaults.standardUserDefaults registerDefaults:@{@"NSFullScreenMenuItemEverywhere" : @NO}];
  // Le nom que le système montre (`app.getName()` d'Electron : « Tentacle TV », Info.plist) ;
  // l'exécutable, lui, garde le nom du paquet (axe systeme).
  NSString* name = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleName"] ?: NSProcessInfo.processInfo.processName;
  NSMenu* bar = [[NSMenu alloc] initWithTitle:@""];

  NSMenu* app = submenu(bar, name);
  item(app, [@"À propos de " stringByAppendingString:name], @selector(orderFrontStandardAboutPanel:), @"");
  [app addItem:NSMenuItem.separatorItem];
  NSMenu* services = [[NSMenu alloc] initWithTitle:@"Services"];
  item(app, @"Services", nil, @"").submenu = services;
  NSApp.servicesMenu = services;
  [app addItem:NSMenuItem.separatorItem];
  item(app, [@"Masquer " stringByAppendingString:name], @selector(hide:), @"h");
  item(app, @"Masquer les autres", @selector(hideOtherApplications:), @"h",
       NSEventModifierFlagCommand | NSEventModifierFlagOption);
  item(app, @"Tout afficher", @selector(unhideAllApplications:), @"");
  [app addItem:NSMenuItem.separatorItem];
  item(app, [@"Quitter " stringByAppendingString:name], @selector(terminate:), @"q");

  NSMenu* ed = submenu(bar, @"Édition");
  editItem(ed, @"Annuler", EditCommand::Undo, @"z");
  editItem(ed, @"Rétablir", EditCommand::Redo, @"z",
           NSEventModifierFlagCommand | NSEventModifierFlagShift);
  [ed addItem:NSMenuItem.separatorItem];
  editItem(ed, @"Couper", EditCommand::Cut, @"x");
  editItem(ed, @"Copier", EditCommand::Copy, @"c");
  editItem(ed, @"Coller", EditCommand::Paste, @"v");
  editItem(ed, @"Coller et adapter le style", EditCommand::PasteAndMatchStyle, @"v",
           NSEventModifierFlagCommand | NSEventModifierFlagShift | NSEventModifierFlagOption);
  editItem(ed, @"Supprimer", EditCommand::Delete, @"", 0);
  editItem(ed, @"Tout sélectionner", EditCommand::SelectAll, @"a");

  NSMenu* win = submenu(bar, @"Fenêtre");
  item(win, @"Réduire", @selector(performMiniaturize:), @"m");
  item(win, @"Zoom", @selector(performZoom:), @"", 0);
  item(win, @"Activer le mode plein écran", @selector(toggleFullScreen:), @"f",
       NSEventModifierFlagCommand | NSEventModifierFlagControl);
  [win addItem:NSMenuItem.separatorItem];
  item(win, @"Tout ramener au premier plan", @selector(arrangeInFront:), @"", 0);
  NSApp.windowsMenu = win;

  NSApp.mainMenu = bar;
}

}  // namespace tentacle::platform
