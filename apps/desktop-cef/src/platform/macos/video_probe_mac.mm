// La sonde de surface sous macOS — DÉVELOPPEMENT (comme Electron : `video/macosEdr.ts`,
// `video/macosCapture.ts`). Deux lectures de `NSScreen` pour le headroom EDR, et une capture
// de la fenêtre par `screencapture` (un processus à part, hors du fil principal : seize
// mégaoctets d'une fenêtre ordinaire, jamais pendant que le fil d'interface attend).
#import <AppKit/AppKit.h>

#include <spawn.h>
#include <sys/wait.h>
#include <unistd.h>

#include <chrono>
#include <cstdio>
#include <fstream>
#include <iterator>
#include <thread>

#include "bridge/glue/video_probe_platform.h"

extern char** environ;

namespace tentacle::probe {

EdrState readEdr(void* nsWindow) {
  NSWindow* window = (__bridge NSWindow*)nsWindow;
  NSScreen* screen = window.screen ?: NSScreen.mainScreen;
  if (!screen) return {0, 0};
  return {screen.maximumExtendedDynamicRangeColorComponentValue,
          screen.maximumPotentialExtendedDynamicRangeColorComponentValue};
}

int windowNumber(void* nsWindow) {
  NSWindow* window = (__bridge NSWindow*)nsWindow;
  return window ? static_cast<int>(window.windowNumber) : 0;
}

void captureWindow(int number, std::function<void(CaptureResult)> done) {
  static int counter = 0;
  const std::string path = std::string(NSTemporaryDirectory().UTF8String) + "tentacle-surface-" +
                           std::to_string(getpid()) + "-" + std::to_string(++counter) + ".bmp";
  std::thread([number, path, done] {
    CaptureResult result;
    // `-o` sans l'ombre portée, `-x` sans le bruit de l'obturateur.
    const std::string id = std::to_string(number);
    const char* argv[] = {"/usr/sbin/screencapture", "-l", id.c_str(), "-o", "-x", "-t", "bmp", path.c_str(), nullptr};
    pid_t pid = 0;
    if (posix_spawn(&pid, argv[0], nullptr, nullptr, const_cast<char**>(argv), environ) != 0) {
      result.error = "screencapture n'a pas pu être lancé";
      return done(std::move(result));
    }
    int status = 0;
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(10);
    while (waitpid(pid, &status, WNOHANG) == 0) {
      if (std::chrono::steady_clock::now() > deadline) {
        kill(pid, SIGKILL);
        waitpid(pid, &status, 0);
        result.error = "screencapture : délai dépassé";
        std::remove(path.c_str());
        return done(std::move(result));
      }
      std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }
    std::ifstream file(path, std::ios::binary);
    if (!file) {
      result.error = "capture absente (autorisation « Enregistrement de l'écran » ?)";
    } else {
      result.bytes.assign(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
    }
    std::remove(path.c_str());
    done(std::move(result));
  }).detach();
}

}  // namespace tentacle::probe
