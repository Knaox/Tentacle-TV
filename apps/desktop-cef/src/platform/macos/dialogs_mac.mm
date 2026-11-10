// Boîtes natives macOS, portées d'Electron 43 (shell/browser/ui/message_box_mac.mm,
// file_dialog_mac.mm) : NSAlert et NSOpenPanel/NSSavePanel en FEUILLE sur la fenêtre de l'app
// (`runModal` seulement si elle est cachée : une feuille sur une fenêtre invisible ne se
// fermerait jamais), filtres en UTType, sélecteur « Format: » quand il y a plusieurs filtres.

#import <AppKit/AppKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#include <filesystem>
#include <memory>

#include "shell/native_dialogs.h"

// Le sélecteur « Format: » d'Electron (`PopUpButtonHandler`) : change les types permis.
@interface TentacleFormatPicker : NSObject
@property(nonatomic, weak) NSSavePanel* panel;
@property(nonatomic, strong) NSArray<NSArray<UTType*>*>* typesList;  // vide = tout permis
- (void)selectFormat:(id)sender;
@end

@implementation TentacleFormatPicker
- (void)selectFormat:(id)sender {
  const NSInteger i = [(NSPopUpButton*)sender indexOfSelectedItem];
  NSArray<UTType*>* types = i >= 0 && i < (NSInteger)self.typesList.count ? self.typesList[i] : @[];
  [self.panel setAllowedContentTypes:types];
}
@end

namespace tentacle::platform {
namespace {

NSWindow* nsWindow(SDL_Window* w) {
  return (__bridge NSWindow*)SDL_GetPointerProperty(SDL_GetWindowProperties(w),
                                                    SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
}

NSString* ns(const std::string& s) { return [NSString stringWithUTF8String:s.c_str()] ?: @""; }

// Une boîte attachée : `dismiss` la ferme sans que sa fin ne réponde à la page.
class MacDialog final : public NativeDialog {
 public:
  MacDialog(NSWindow* parent, NSWindow* sheet, std::shared_ptr<bool> dismissed, id keepAlive)
      : parent_(parent), sheet_(sheet), dismissed_(std::move(dismissed)), keepAlive_(keepAlive) {}
  ~MacDialog() override = default;
  void dismiss() override {
    if (*dismissed_) return;
    *dismissed_ = true;
    if ([sheet_ isKindOfClass:[NSSavePanel class]]) {
      [(NSSavePanel*)sheet_ cancel:nil];
    } else if (parent_ && sheet_.sheetParent == parent_) {
      [parent_ endSheet:sheet_ returnCode:NSModalResponseAbort];
    } else {
      [NSApp abortModal];
    }
  }

 private:
  __weak NSWindow* parent_;
  NSWindow* sheet_;
  std::shared_ptr<bool> dismissed_;
  [[maybe_unused]] id keepAlive_;  // l'alerte, le sélecteur de format : vivants autant que la boîte
};

// `SetAllowedFileTypes` d'Electron : les types du PREMIER filtre ; plusieurs filtres → le
// sélecteur « Format: » (« * » = tous les fichiers).
TentacleFormatPicker* setAllowedFileTypes(NSSavePanel* panel,
                                          const std::vector<dialogs::FileFilter>& filters) {
  NSMutableArray<NSArray<UTType*>*>* typesList = [NSMutableArray array];
  NSMutableArray<NSString*>* names = [NSMutableArray array];
  for (const auto& filter : filters) {
    NSMutableOrderedSet<UTType*>* types = [NSMutableOrderedSet orderedSet];
    bool all = false;
    [names addObject:ns(filter.name)];
    for (std::string ext : filter.extensions) {
      // macOS ne comprend pas « tar.gz » : seule la dernière extension compte.
      if (auto dot = ext.rfind('.'); dot != std::string::npos) ext.erase(0, dot + 1);
      if (ext == "*") {
        all = true;
        break;
      }
      if (UTType* t = [UTType typeWithFilenameExtension:ns(ext)]) [types addObject:t];
    }
    [typesList addObject:all ? @[] : types.array];
  }
  if (typesList.count > 0 && typesList[0].count > 0) [panel setAllowedContentTypes:typesList[0]];
  if (typesList.count <= 1) return nil;

  NSView* accessory = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, 200, 32)];
  NSTextField* label = [[NSTextField alloc] initWithFrame:NSMakeRect(0, 0, 60, 22)];
  [label setEditable:NO];
  [label setStringValue:@"Format:"];
  [label setBordered:NO];
  [label setBezeled:NO];
  [label setDrawsBackground:NO];
  NSPopUpButton* popup = [[NSPopUpButton alloc] initWithFrame:NSMakeRect(50, 2, 140, 22)
                                                    pullsDown:NO];
  TentacleFormatPicker* picker = [TentacleFormatPicker new];
  picker.panel = panel;
  picker.typesList = typesList;
  [popup addItemsWithTitles:names];
  [popup setTarget:picker];
  [popup setAction:@selector(selectFormat:)];
  [accessory addSubview:label];
  [accessory addSubview:popup];
  [panel setAccessoryView:accessory];
  return picker;
}

// `SetupDialog` d'Electron.
TentacleFormatPicker* setupPanel(NSSavePanel* panel, const dialogs::FileRequest& r) {
  if (!r.title.empty()) [panel setTitle:ns(r.title)];
  NSString* dir = nil;
  NSString* name = nil;
  if (!r.defaultPath.empty()) {
    std::error_code ec;
    const std::filesystem::path p(r.defaultPath);
    if (std::filesystem::is_directory(p, ec)) {
      dir = ns(r.defaultPath);
    } else {
      if (p.is_absolute()) dir = ns(p.parent_path().string());
      name = ns(p.filename().string());
    }
  }
  TentacleFormatPicker* picker = nil;
  if (r.filters.empty()) {
    [panel setAllowsOtherFileTypes:YES];
  } else {
    picker = setAllowedFileTypes(panel, r.filters);
  }
  [panel setExtensionHidden:NO];
  if (dir) [panel setDirectoryURL:[NSURL fileURLWithPath:dir]];
  if (name) [panel setNameFieldStringValue:name];
  return picker;
}

}  // namespace

std::unique_ptr<NativeDialog> showMessageBox(SDL_Window* parent, const dialogs::MessageBox& box,
                                             MessageDone done) {
  // `CreateNSAlert` d'Electron : message en titre de l'alerte, boutons dans l'ordre, étiquette
  // = index, bouton par défaut sur Entrée, bouton d'annulation sur Échap (s'il y en a plusieurs).
  NSAlert* alert = [[NSAlert alloc] init];
  [alert setMessageText:ns(box.message)];
  [alert setInformativeText:@""];
  for (size_t i = 0; i < box.buttons.size(); ++i) {
    NSButton* b = [alert addButtonWithTitle:box.buttons[i].empty() ? @"(empty)" : ns(box.buttons[i])];
    [b setTag:NSInteger(i)];
  }
  NSArray<NSButton*>* buttons = alert.buttons;
  const int count = int(buttons.count);
  if (box.defaultId >= 0 && box.defaultId < count) {
    [buttons[box.defaultId] highlight:YES];
    if (box.defaultId != 0) {
      [buttons[0] setKeyEquivalent:@""];
      [buttons[box.defaultId] setKeyEquivalent:@"\r"];
    }
  }
  if (count > 1 && box.cancelId >= 0 && box.cancelId < count) {
    [buttons[box.cancelId] setKeyEquivalent:@"\e"];
  }
  if (box.cancelId == box.defaultId && box.defaultId >= 0 && box.defaultId < count) {
    [buttons[box.defaultId] highlight:NO];
  }

  auto dismissed = std::make_shared<bool>(false);
  const int cancelId = box.cancelId;
  auto finish = [dismissed, done, cancelId](NSModalResponse r) {
    if (*dismissed) return;
    *dismissed = true;
    done(r >= 0 && r < 1000 ? int(r) : cancelId);
  };
  NSWindow* window = nsWindow(parent);
  if (window && window.isVisible) {
    [alert beginSheetModalForWindow:window
                  completionHandler:^(NSModalResponse r) {
                    finish(r);
                  }];
  } else {
    // Fenêtre cachée : comme Electron, une alerte modale de l'application.
    dispatch_async(dispatch_get_main_queue(), ^{
      finish([alert runModal]);
    });
  }
  return std::make_unique<MacDialog>(window, alert.window, dismissed, alert);
}

bool hasNativeFileDialog() { return true; }

std::unique_ptr<NativeDialog> showFileDialog(SDL_Window* parent, const dialogs::FileRequest& r,
                                             FileDone done) {
  NSSavePanel* panel = nil;
  if (r.mode == dialogs::FileMode::save) {
    panel = [NSSavePanel savePanel];
  } else {
    // `SetupOpenDialogForProperties` d'Electron.
    NSOpenPanel* open = [NSOpenPanel openPanel];
    const bool folder = r.mode == dialogs::FileMode::openFolder;
    [open setCanChooseFiles:!folder];
    if (folder) [open setCanChooseDirectories:YES];
    if (r.createDirectory) [open setCanCreateDirectories:YES];
    if (r.mode == dialogs::FileMode::openMultiple) [open setAllowsMultipleSelection:YES];
    if (r.treatPackageAsDirectory) [open setTreatsFilePackagesAsDirectories:YES];
    panel = open;
  }
  TentacleFormatPicker* picker = setupPanel(panel, r);

  auto dismissed = std::make_shared<bool>(false);
  const bool save = r.mode == dialogs::FileMode::save;
  auto finish = [dismissed, done, save, panel](NSModalResponse response) {
    if (*dismissed) return;
    *dismissed = true;
    if (response != NSModalResponseOK) return done(std::nullopt);
    std::vector<std::string> paths;
    if (save) {
      if (panel.URL.path) paths.emplace_back(panel.URL.path.UTF8String);
    } else {
      for (NSURL* url in ((NSOpenPanel*)panel).URLs) {
        if (url.path) paths.emplace_back(url.path.UTF8String);
      }
    }
    done(std::move(paths));
  };
  NSWindow* window = nsWindow(parent);
  if (window && window.isVisible) {
    [panel beginSheetModalForWindow:window
                  completionHandler:^(NSModalResponse response) {
                    (void)picker;  // le sélecteur vit autant que le panneau
                    finish(response);
                  }];
  } else {
    dispatch_async(dispatch_get_main_queue(), ^{
      (void)picker;
      finish([panel runModal]);
    });
  }
  return std::make_unique<MacDialog>(window, panel, dismissed, picker);
}

}  // namespace tentacle::platform
