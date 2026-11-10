// Windows : ce que le cycle de vie demande au système.
//
// - Notification : une bulle de la zone de notification (NIF_INFO, sans son), que Windows 10/11
//   présente en notification système ; l'icône est retirée ensuite.
// - Boîte et sélecteur de dossier : SDL3 (TaskDialog, IFileDialog) — lifecycle/sdl_system.h.
// - Retour de veille : `PowerRegisterSuspendResumeNotification` (ce qu'écoute Chromium).
// - Relance : le même exécutable, sa ligne de commande d'origine (GetCommandLineW), plus
//   `--relaunch-after=<pid>` ; l'instance relancée attend notre sortie.

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0602
#endif
#include <windows.h>
#include <powrprof.h>
#include <shellapi.h>

#include <iterator>
#include <string>
#include <vector>

#include "lifecycle/lifecycle_platform.h"
#include "lifecycle/sdl_system.h"
#include "shell/main_thread.h"

namespace tentacle::lifecycle::platform {
namespace {

constexpr UINT kTrayId = 0x7e57;
constexpr int64_t kTrayLifetimeMs = 15'000;

std::wstring wide(const std::string& s) {
  if (s.empty()) return {};
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), nullptr, 0);
  std::wstring out(size_t(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), out.data(), n);
  return out;
}

HWND hostWindow() {
  // La fenêtre principale existe toujours (cachée pendant la fin des transferts).
  int count = 0;
  SDL_Window** windows = SDL_GetWindows(&count);
  HWND hwnd = nullptr;
  if (windows && count > 0) {
    hwnd = static_cast<HWND>(SDL_GetPointerProperty(SDL_GetWindowProperties(windows[0]),
                                                    SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr));
  }
  SDL_free(windows);
  return hwnd;
}

// Règles de citation de CommandLineToArgvW.
std::wstring quote(const std::wstring& arg) {
  if (!arg.empty() && arg.find_first_of(L" \t\n\v\"") == std::wstring::npos) return arg;
  std::wstring out = L"\"";
  for (size_t i = 0;; ++i) {
    size_t slashes = 0;
    while (i < arg.size() && arg[i] == L'\\') ++i, ++slashes;
    if (i == arg.size()) {
      out.append(slashes * 2, L'\\');
      break;
    }
    if (arg[i] == L'"') out.append(slashes * 2 + 1, L'\\');
    else out.append(slashes, L'\\');
    out.push_back(arg[i]);
  }
  return out + L"\"";
}

std::function<void()> g_resume;
ULONG CALLBACK onPowerEvent(PVOID, ULONG type, PVOID) {
  if (type == PBT_APMRESUMEAUTOMATIC && g_resume) postToMain(g_resume);
  return 0;
}

}  // namespace

bool systemLocaleIsFrench() { return PRIMARYLANGID(GetUserDefaultUILanguage()) == LANG_FRENCH; }

void notify(const std::string& title, const std::string& body) {
  HWND hwnd = hostWindow();
  if (!hwnd) return;
  NOTIFYICONDATAW data{};
  data.cbSize = sizeof(data);
  data.hWnd = hwnd;
  data.uID = kTrayId;
  data.uFlags = NIF_ICON | NIF_INFO | NIF_TIP;
  data.hIcon = LoadIconW(GetModuleHandleW(nullptr), MAKEINTRESOURCEW(1));
  if (!data.hIcon) data.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
  wcsncpy_s(data.szTip, L"Tentacle TV", _TRUNCATE);
  wcsncpy_s(data.szInfoTitle, wide(title).c_str(), _TRUNCATE);
  wcsncpy_s(data.szInfo, wide(body).c_str(), _TRUNCATE);
  data.dwInfoFlags = NIIF_INFO | NIIF_NOSOUND;  // `silent: true`
  Shell_NotifyIconW(NIM_DELETE, &data);
  if (!Shell_NotifyIconW(NIM_ADD, &data)) return;
  postToMainDelayed(
      [hwnd] {
        NOTIFYICONDATAW gone{};
        gone.cbSize = sizeof(gone);
        gone.hWnd = hwnd;
        gone.uID = kTrayId;
        Shell_NotifyIconW(NIM_DELETE, &gone);
      },
      kTrayLifetimeMs);
}

void askQuit(SDL_Window* window, const QuitTexts& texts, std::function<void(bool)> answer) {
  askQuitWithSdl(window, texts, std::move(answer));
}

void pickFolder(SDL_Window* window, std::function<void(std::optional<std::string>)> done) {
  pickFolderWithSdl(window, std::move(done));
}

void watchSystemResume(std::function<void()> onResume) {
  g_resume = std::move(onResume);
  using Register = DWORD(WINAPI*)(DWORD, HANDLE, PHPOWERNOTIFY);
  HMODULE powrprof = LoadLibraryW(L"powrprof.dll");
  auto reg = powrprof ? reinterpret_cast<Register>(GetProcAddress(powrprof, "PowerRegisterSuspendResumeNotification"))
                      : nullptr;
  if (!reg) return;
  static DEVICE_NOTIFY_SUBSCRIBE_PARAMETERS params{onPowerEvent, nullptr};
  static HPOWERNOTIFY handle = nullptr;
  reg(DEVICE_NOTIFY_CALLBACK, &params, &handle);
}

bool spawnSuccessor(const std::vector<std::string>&) {
  wchar_t exe[MAX_PATH * 4] = {};
  if (!GetModuleFileNameW(nullptr, exe, DWORD(std::size(exe)))) return false;
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  std::wstring line = quote(exe);
  for (int i = 1; argv && i < argc; ++i) {
    const std::wstring a = argv[i];
    if (a.rfind(L"--relaunch-after", 0) == 0) continue;
    line += L" " + quote(a);
  }
  if (argv) LocalFree(argv);
  line += L" --relaunch-after=" + std::to_wstring(GetCurrentProcessId());
  STARTUPINFOW si{};
  si.cb = sizeof(si);
  PROCESS_INFORMATION pi{};
  if (!CreateProcessW(exe, line.data(), nullptr, nullptr, FALSE, 0, nullptr, nullptr, &si, &pi)) return false;
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  return true;
}

void waitForProcessExit(long pid, int timeoutMs) {
  HANDLE process = OpenProcess(SYNCHRONIZE, FALSE, DWORD(pid));
  if (!process) return;
  WaitForSingleObject(process, DWORD(timeoutMs));
  CloseHandle(process);
}

void installSystemEvents(std::function<void(const std::string&)>, std::function<void()>) {}
void reclaimSystemEvents() {}

void prepareMainWindow(SDL_Window* window) { setWindowIconFromPng(window); }
double titleBarHeight() { return 0; }  // vrai cadre : la page ne dessine aucune bande
bool hasWindowFocusBridge() { return false; }
void setAboutPanel(const std::string&, const std::string&) {}  // pas de menu hors macOS

namespace {
bool g_noActivation = false;
}  // namespace

void setNoActivation(bool on) { g_noActivation = on; }
std::string windowDebug(SDL_Window*) { return "{}"; }
std::string sheetDebug(SDL_Window*, int) { return "{}"; }  // boîtes modales SDL : rien d'attaché

void focusWindow(SDL_Window* window) {
  if (!window || g_noActivation) return;
  if (SDL_GetWindowFlags(window) & SDL_WINDOW_MINIMIZED) SDL_RestoreWindow(window);
  SDL_RaiseWindow(window);
}

}  // namespace tentacle::lifecycle::platform
