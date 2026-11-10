// Ce que l'application attend de Linux (app/platform_app.h) : pilote vidéo de SDL selon la
// session graphique, poignées natives de la fenêtre, langues du système, ressources.

#include <unistd.h>

#include <climits>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <map>
#include <memory>
#include <optional>
#include <string>

#include "app/platform_app.h"
#include "platform/linux/graphics_session.h"
#include "platform/linux/linux_window.h"
#include "platform/linux/locale_linux.h"

namespace tentacle::platform {
namespace {

std::optional<std::string> processEnv(const char* name) {
  const char* v = std::getenv(name);
  if (!v) return std::nullopt;
  return std::string(v);
}

std::filesystem::path executableDir() {
  char buf[PATH_MAX];
  const ssize_t n = readlink("/proc/self/exe", buf, sizeof buf - 1);
  if (n <= 0) return {};
  buf[n] = 0;
  return std::filesystem::path(buf).parent_path();
}

}  // namespace

bool sdlIsWayland() {
  const char* d = SDL_GetCurrentVideoDriver();
  return d && std::strcmp(d, "wayland") == 0;
}

LinuxWindow* linuxWindow(SDL_Window* window) {
  // UNE description par fenêtre, à adresse stable : le pont garde celle de la fenêtre
  // principale (createVideoSurface) pendant que le PiP demande la sienne. Clé : l'identifiant
  // SDL, jamais réutilisé (une adresse de fenêtre libérée peut l'être).
  static std::map<SDL_WindowID, std::unique_ptr<LinuxWindow>> windows;
  static LinuxWindow none;
  if (!window) return &none;
  auto& slot = windows[SDL_GetWindowID(window)];
  if (slot) return slot.get();
  slot = std::make_unique<LinuxWindow>();
  LinuxWindow& w = *slot;
  w.sdl = window;
  const SDL_PropertiesID p = SDL_GetWindowProperties(window);
  w.wayland = sdlIsWayland();
  if (w.wayland) {
    w.wlDisplay = static_cast<wl_display*>(
        SDL_GetPointerProperty(p, SDL_PROP_WINDOW_WAYLAND_DISPLAY_POINTER, nullptr));
    w.wlSurface = static_cast<wl_surface*>(
        SDL_GetPointerProperty(p, SDL_PROP_WINDOW_WAYLAND_SURFACE_POINTER, nullptr));
  } else {
    w.x11Display = SDL_GetPointerProperty(p, SDL_PROP_WINDOW_X11_DISPLAY_POINTER, nullptr);
    w.x11Window = uint64_t(SDL_GetNumberProperty(p, SDL_PROP_WINDOW_X11_WINDOW_NUMBER, 0));
  }
  return &w;
}

void initApplication() {
  // La session est décidée AVANT SDL_Init (et le main l'a déjà donnée à Ozone, pour CEF) :
  // SDL et Chromium parlent au même serveur d'affichage.
  const DecidedSession& s = startupSession();
  const bool wayland = s.montage == DisplayServer::kWayland;
  SDL_SetHint(SDL_HINT_VIDEO_DRIVER, wayland ? "wayland" : "x11");
  // EGL partout (X11 compris) : un seul chemin de rendu pour le compositeur de la page.
  SDL_SetHint(SDL_HINT_VIDEO_FORCE_EGL, "1");
  // Le nom d'application que le compositeur associe au fichier .desktop (app_id / WM_CLASS).
  SDL_SetHint(SDL_HINT_APP_ID, "tentacle-tv");
  std::fprintf(stderr, "[session] bureau=%s choix=%s montage=%s%s\n",
               displayServerName(s.desktop), sessionChoiceName(s.choice),
               displayServerName(s.montage), wayland ? " (HDR possible)" : " (pas de HDR)");
}

void* nativeWindow(SDL_Window* window) { return linuxWindow(window); }

void prepareWindow(SDL_Window* window, bool activate) {
  if (activate) SDL_RaiseWindow(window);
}

std::string resourceUrl(const char* name) {
  const auto dir = executableDir();
  if (dir.empty()) return "about:blank";
  const auto file = dir / "resources" / name;
  std::error_code ec;
  if (!std::filesystem::exists(file, ec)) return "about:blank";
  return "file://" + file.string();
}

std::string acceptLanguages() { return acceptLanguagesFrom(processEnv); }

}  // namespace tentacle::platform
