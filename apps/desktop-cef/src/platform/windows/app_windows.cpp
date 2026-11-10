// Windows : ce que l'application attend de l'OS (app/platform_app.h) — DPI par écran, IME,
// icône et cadre de la fenêtre, langues du système, ressources livrées à côté de l'exe.
// ⚠️ Écrit et compilé à blanc depuis macOS (aucune machine Windows dans le lot) : voir
// docs/A-TESTER-WINDOWS.md.

#include <windows.h>
#include <dwmapi.h>

#include <SDL3/SDL.h>

#include <filesystem>
#include <string>
#include <vector>

#include "app/platform_app.h"
#include "platform/windows/win_util.h"

namespace tentacle::platform {
namespace {

// DWMWA_USE_IMMERSIVE_DARK_MODE : 20 depuis Windows 10 20H1 (absent des SDK d'avant 22000).
constexpr DWORD kImmersiveDarkMode = 20;

// Le thème des applications choisi dans Paramètres › Personnalisation › Couleurs. Electron
// (nativeTheme « system ») assombrit sa barre de titre selon lui : nous aussi.
bool systemUsesDarkApps() {
  DWORD light = 1, size = sizeof light;
  const LSTATUS st = RegGetValueW(HKEY_CURRENT_USER,
                                  L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
                                  L"AppsUseLightTheme", RRF_RT_REG_DWORD, nullptr, &light, &size);
  return st == ERROR_SUCCESS && light == 0;
}

std::filesystem::path exeDir() {
  std::wstring buf(MAX_PATH, L'\0');
  for (;;) {
    const DWORD n = GetModuleFileNameW(nullptr, buf.data(), DWORD(buf.size()));
    if (n == 0) return {};
    if (n < buf.size()) {
      buf.resize(n);
      break;
    }
    buf.resize(buf.size() * 2);  // chemin long (longPathAware dans le manifeste)
  }
  return std::filesystem::path(buf).parent_path();
}

}  // namespace

void initApplication() {
  // Le manifeste déclare déjà le DPI par écran v2 ; l'appel couvre un lancement sans lui
  // (débogueur, exécutable renommé) et reste sans effet sinon. SDL3 fait de même.
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  // SDL livre la composition (SDL_EVENT_TEXT_EDITING) que CEF dessine DANS la page ; la liste
  // des candidats reste celle du système, placée par SDL_SetTextInputArea (comme macOS).
  SDL_SetHint(SDL_HINT_IME_IMPLEMENTED_UI, "composition");
  // L'icône de la fenêtre et de la barre des tâches : la ressource 1 de l'exécutable
  // (resources/windows/tentacle.rc, l'icône d'Electron).
  SDL_SetHint(SDL_HINT_WINDOWS_INTRESOURCE_ICON, "1");
  SDL_SetHint(SDL_HINT_WINDOWS_INTRESOURCE_ICON_SMALL, "1");
  // La surface de redirection de la fenêtre est sous nos visuels DirectComposition : peinte
  // en noir à chaque effacement, les bords découverts pendant un redimensionnement restent
  // noirs (le fond d'Electron, #000000) au lieu de blancs.
  SDL_SetHint(SDL_HINT_WINDOWS_ERASE_BACKGROUND_MODE, "always");
}

void* nativeWindow(SDL_Window* window) {
  return SDL_GetPointerProperty(SDL_GetWindowProperties(window), SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr);
}

void prepareWindow(SDL_Window* window, bool activate) {
  HWND hwnd = static_cast<HWND>(nativeWindow(window));
  if (!hwnd) return;
  const BOOL dark = systemUsesDarkApps() ? TRUE : FALSE;
  DwmSetWindowAttribute(hwnd, kImmersiveDarkMode, &dark, sizeof dark);
  if (activate) {
    SDL_RaiseWindow(window);
  } else {
    // --background : la fenêtre paraît sans prendre le focus (bancs, jamais voler la main).
    SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
  }
}

std::string acceptLanguages() {
  // Langues d'affichage préférées (« fr-FR », « en-US »…), chacune suivie de sa base (« fr »)
  // si elle manque : la liste qu'Electron/Chromium dérive du système.
  ULONG count = 0, size = 0;
  if (!GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &count, nullptr, &size) || size == 0) return "";
  std::vector<wchar_t> buf(size);
  if (!GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &count, buf.data(), &size)) return "";
  std::vector<std::string> tags;
  auto add = [&tags](const std::string& t) {
    if (t.empty()) return;
    for (const auto& have : tags)
      if (have == t) return;
    tags.push_back(t);
  };
  for (const wchar_t* p = buf.data(); *p; p += wcslen(p) + 1) {
    const std::string tag = win::utf8(p);
    add(tag);
    add(tag.substr(0, tag.find('-')));
  }
  std::string out;
  for (const auto& t : tags) out += (out.empty() ? "" : ",") + t;
  return out;
}

std::string resourceUrl(const char* name) {
  // Les ressources sont posées à côté de l'exécutable par le build (CMakeLists.txt, WIN32).
  const std::filesystem::path file = exeDir() / win::wide(name);
  std::error_code ec;
  if (!std::filesystem::exists(file, ec)) return "about:blank";
  std::string url = "file:///";
  for (char c : win::utf8(file.generic_wstring())) {
    if (c == ' ') url += "%20";
    else url += c;
  }
  return url;
}

}  // namespace tentacle::platform
