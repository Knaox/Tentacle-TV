// macOS : ce que le cycle de vie demande au système — langue, notification, boîte « quitter
// quand même ? », sélecteur de dossier, retour de veille, liens et réouverture (Apple events).

#import <Cocoa/Cocoa.h>
#import <UserNotifications/UserNotifications.h>
#include <mach-o/dyld.h>
#include <signal.h>
#include <spawn.h>
#include <unistd.h>

#include <chrono>
#include <cstring>
#include <memory>
#include <thread>
#include <vector>

extern char** environ;

#include "lifecycle/lifecycle_platform.h"

namespace {

NSString* ns(const std::string& s) { return [NSString stringWithUTF8String:s.c_str()] ?: @""; }

NSWindow* nsWindow(SDL_Window* window) {
  if (!window) return nil;
  return (__bridge NSWindow*)SDL_GetPointerProperty(SDL_GetWindowProperties(window),
                                                     SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
}

std::function<void(const std::string&)> g_openUrl;
std::function<void()> g_reopen;
std::function<void()> g_resume;

}  // namespace

// Les Apple events du système : GetURL (lien `tentacle://`, y compris celui qui LANCE l'app) et
// Reopen (clic dans le Dock, ouverture du paquet alors qu'il tourne). Posés avant
// `finishLaunching` : sinon le lien du lancement est perdu (`open-url` d'Electron, à écouter
// avant `whenReady`).
@interface TentacleSystemEvents : NSObject
@end
@implementation TentacleSystemEvents
- (void)getUrl:(NSAppleEventDescriptor*)event withReplyEvent:(NSAppleEventDescriptor*)reply {
  NSString* url = [event paramDescriptorForKeyword:keyDirectObject].stringValue;
  if (url && g_openUrl) g_openUrl(url.UTF8String);
}
- (void)reopen:(NSAppleEventDescriptor*)event withReplyEvent:(NSAppleEventDescriptor*)reply {
  if (g_reopen) g_reopen();
}
- (void)didWake:(NSNotification*)note {
  if (g_resume) g_resume();
}
@end

namespace tentacle::lifecycle::platform {
namespace {
TentacleSystemEvents* g_events = nil;
TentacleSystemEvents* events() {
  if (!g_events) g_events = [TentacleSystemEvents new];
  return g_events;
}
}  // namespace

bool systemLocaleIsFrench() {
  NSString* lang = NSLocale.preferredLanguages.firstObject ?: NSLocale.currentLocale.localeIdentifier;
  return [lang.lowercaseString hasPrefix:@"fr"];
}

void notify(const std::string& title, const std::string& body) {
  // `new Notification({ title, body, silent: true }).show()` : demandée à la première fois
  // (l'autorisation est celle du système, comme pour Electron).
  UNUserNotificationCenter* center = UNUserNotificationCenter.currentNotificationCenter;
  NSString* t = ns(title);
  NSString* b = ns(body);
  [center requestAuthorizationWithOptions:UNAuthorizationOptionAlert
                        completionHandler:^(BOOL granted, NSError* error) {
                          if (!granted) return;
                          UNMutableNotificationContent* content = [UNMutableNotificationContent new];
                          content.title = t;
                          content.body = b;
                          UNNotificationRequest* request =
                              [UNNotificationRequest requestWithIdentifier:NSUUID.UUID.UUIDString
                                                                   content:content
                                                                   trigger:nil];
                          [center addNotificationRequest:request withCompletionHandler:nil];
                        }];
}

void askQuit(SDL_Window* window, const QuitTexts& texts, std::function<void(bool)> answer) {
  // `dialog.showMessageBox(window, …)` : une feuille sur la fenêtre, avertissement, « Annuler »
  // par défaut (Entrée comme Échap : un réflexe ne doit pas interrompre un transfert).
  NSAlert* alert = [NSAlert new];
  alert.alertStyle = NSAlertStyleWarning;
  alert.messageText = ns(texts.message);
  alert.informativeText = ns(texts.detail);
  NSButton* quit = [alert addButtonWithTitle:ns(texts.quitApp)];
  NSButton* cancel = [alert addButtonWithTitle:ns(texts.cancelLabel)];
  quit.keyEquivalent = @"";
  cancel.keyEquivalent = @"\r";
  auto once = std::make_shared<std::function<void(bool)>>(std::move(answer));
  auto respond = ^(NSModalResponse r) {
    if (!*once) return;
    auto fn = std::move(*once);
    *once = nullptr;
    fn(r == NSAlertFirstButtonReturn);
  };
  NSWindow* host = nsWindow(window);
  if (host && host.visible) {
    [alert beginSheetModalForWindow:host completionHandler:respond];
  } else {
    respond([alert runModal]);
  }
}

void pickFolder(SDL_Window* window, std::function<void(std::optional<std::string>)> done) {
  // properties: ["openDirectory", "createDirectory"].
  NSOpenPanel* panel = [NSOpenPanel openPanel];
  panel.canChooseFiles = NO;
  panel.canChooseDirectories = YES;
  panel.canCreateDirectories = YES;
  panel.allowsMultipleSelection = NO;
  auto once = std::make_shared<std::function<void(std::optional<std::string>)>>(std::move(done));
  auto respond = ^(NSModalResponse r) {
    if (!*once) return;
    auto fn = std::move(*once);
    *once = nullptr;
    NSURL* url = panel.URLs.firstObject;
    if (r == NSModalResponseOK && url.path) fn(std::string(url.path.UTF8String));
    else fn(std::nullopt);
  };
  NSWindow* host = nsWindow(window);
  if (host && host.visible) [panel beginSheetModalForWindow:host completionHandler:respond];
  else respond([panel runModal]);
}

void watchSystemResume(std::function<void()> onResume) {
  g_resume = std::move(onResume);
  [NSWorkspace.sharedWorkspace.notificationCenter addObserver:events()
                                                     selector:@selector(didWake:)
                                                         name:NSWorkspaceDidWakeNotification
                                                       object:nil];
}

bool spawnSuccessor(const std::vector<std::string>& argv) {
  // `app.relaunch()` : le même exécutable, la même ligne de commande, plus l'ordre d'attendre
  // notre sortie. Aucun descripteur ne passe (le verrou d'instance unique de CEF en est un).
  uint32_t size = 0;
  _NSGetExecutablePath(nullptr, &size);
  std::string exe(size, '\0');
  if (_NSGetExecutablePath(exe.data(), &size) != 0) return false;
  exe.resize(std::strlen(exe.c_str()));
  std::vector<std::string> args{exe};
  for (size_t i = 1; i < argv.size(); ++i) args.push_back(argv[i]);
  args.push_back("--relaunch-after=" + std::to_string(getpid()));
  std::vector<char*> raw;
  for (auto& a : args) raw.push_back(a.data());
  raw.push_back(nullptr);
  posix_spawnattr_t attr;
  posix_spawnattr_init(&attr);
  posix_spawnattr_setflags(&attr, POSIX_SPAWN_CLOEXEC_DEFAULT | POSIX_SPAWN_SETPGROUP);
  posix_spawn_file_actions_t actions;
  posix_spawn_file_actions_init(&actions);
  for (int fd = 0; fd <= 2; ++fd) posix_spawn_file_actions_addinherit_np(&actions, fd);
  pid_t pid = 0;
  const int r = posix_spawn(&pid, exe.c_str(), &actions, &attr, raw.data(), environ);
  posix_spawn_file_actions_destroy(&actions);
  posix_spawnattr_destroy(&attr);
  return r == 0;
}

void waitForProcessExit(long pid, int timeoutMs) {
  const auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);
  while (kill(pid_t(pid), 0) == 0 && std::chrono::steady_clock::now() < end) {
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
  }
}

void installSystemEvents(std::function<void(const std::string&)> openUrl, std::function<void()> reopen) {
  g_openUrl = std::move(openUrl);
  g_reopen = std::move(reopen);
  NSAppleEventManager* m = NSAppleEventManager.sharedAppleEventManager;
  [m setEventHandler:events() andSelector:@selector(getUrl:withReplyEvent:)
       forEventClass:kInternetEventClass andEventID:kAEGetURL];
  [m setEventHandler:events() andSelector:@selector(reopen:withReplyEvent:)
       forEventClass:kCoreEventClass andEventID:kAEReopenApplication];
}

}  // namespace tentacle::lifecycle::platform
