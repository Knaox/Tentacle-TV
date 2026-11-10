// Le dossier de données d'Electron (voir paths.h). Seul `currentEnvironment` lit le système :
// c'est l'aiguillage d'OS, le reste est la règle pure.

#include "shell/paths.h"

#include <cstdlib>
#include <mutex>

#if defined(_WIN32)
#include <stdlib.h>  // _wgetenv
#else
#include <pwd.h>
#include <unistd.h>
#endif

namespace tentacle::paths {
namespace fs = std::filesystem;

namespace {

// Un chemin absolu au sens POSIX (`path.isAbsolute` de Node sous Linux) : il commence par
// « / ». Un XDG_DATA_HOME relatif est invalide (spécification XDG) et serait résolu depuis le
// dossier courant — celui d'où l'app a été lancée.
bool isPosixAbsolute(const std::string& p) { return !p.empty() && p.front() == '/'; }

std::mutex g_mutex;
std::optional<fs::path> g_override;  // --user-data
std::optional<fs::path> g_resolved;  // le dossier, calculé une fois

// Les options arrivent en UTF-8 ; sous Windows, un `std::string` serait lu dans la page de
// code ANSI.
fs::path fromUtf8(const std::string& s) {
  return fs::path(std::u8string(reinterpret_cast<const char8_t*>(s.data()), s.size()));
}

#if !defined(_WIN32)
fs::path posixHome() {
  if (const char* h = std::getenv("HOME"); h && *h) return h;
  // Repli d'Electron (base::GetHomeDir) : le compte de l'utilisateur.
  if (const passwd* pw = getpwuid(getuid()); pw && pw->pw_dir) return pw->pw_dir;
  return "/tmp";
}
#endif

}  // namespace

fs::path dataRoot(const DataEnvironment& e) {
  if (e.platform != Platform::kLinux) return e.appData;
  if (e.xdgDataHome && isPosixAbsolute(*e.xdgDataHome)) return fromUtf8(*e.xdgDataHome);
  return e.home / ".local" / "share";
}

fs::path dataFolder(const DataEnvironment& e) { return dataRoot(e) / kTauriIdentifier; }

DataEnvironment currentEnvironment() {
  DataEnvironment e;
#if defined(_WIN32)
  // `app.getPath("appData")` d'Electron = FOLDERID_RoamingAppData, que %APPDATA% désigne ;
  // lu en large pour un nom d'utilisateur hors ASCII.
  e.platform = Platform::kWindows;
  const wchar_t* profile = _wgetenv(L"USERPROFILE");
  e.home = profile ? fs::path(profile) : fs::path(L"C:\\");
  const wchar_t* roaming = _wgetenv(L"APPDATA");
  e.appData = (roaming && *roaming) ? fs::path(roaming) : e.home / L"AppData" / L"Roaming";
#elif defined(__APPLE__)
  // NSApplicationSupportDirectory : ~/Library/Application Support (dans le conteneur du bac à
  // sable, HOME y pointe déjà).
  e.platform = Platform::kMacos;
  e.home = posixHome();
  e.appData = e.home / "Library" / "Application Support";
#else
  e.platform = Platform::kLinux;
  e.home = posixHome();
  if (const char* xdg = std::getenv("XDG_DATA_HOME")) e.xdgDataHome = std::string(xdg);
#endif
  return e;
}

void configure(const std::map<std::string, std::string>& extraOptions) {
  std::lock_guard lock(g_mutex);
  g_override.reset();
  g_resolved.reset();
  if (auto it = extraOptions.find("user-data"); it != extraOptions.end() && !it->second.empty()) {
    std::error_code ec;
    const fs::path given = fromUtf8(it->second);
    const fs::path p = fs::absolute(given, ec);
    g_override = ec ? given : p.lexically_normal();
  }
}

fs::path userData() {
  std::lock_guard lock(g_mutex);
  if (!g_resolved) g_resolved = g_override ? *g_override : dataFolder(currentEnvironment());
  return *g_resolved;
}

}  // namespace tentacle::paths
