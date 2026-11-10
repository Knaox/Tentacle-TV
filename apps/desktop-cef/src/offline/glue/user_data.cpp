// Le dossier de données d'Electron, en attendant `tentacle::paths::userData()` (axe
// `reseau`, `src/shell/paths.h`) — COUTURE LOCALE, à remplacer par l'appel dès qu'il est
// publié au journal du lot. Elle ne décide rien de plus que ce qu'on lui donne :
//   1. `--user-data=<dossier>` (l'option que l'axe `reseau` pose) ;
//   2. `TENTACLE_ELECTRON_PROFILE` (le profil de banc que `pnpm dev:cef` reçoit) ;
//   3. sinon le dossier d'Electron (`dataPaths.ts`) : Application Support, %APPDATA%, XDG.

#include "offline/glue/user_data.h"

#include <cstdlib>
#include <string>

#include "app/args.h"
#include "offline/core/utf8_path.h"

namespace tentacle::offline {
namespace {

constexpr const char* kIdentifier = "com.tentacle.media";  // `TAURI_IDENTIFIER` de dataPaths.ts

std::string env(const char* name) {
  const char* value = std::getenv(name);
  return value == nullptr ? std::string() : std::string(value);
}

/// Une variable qui porte un CHEMIN : en caractères larges sous Windows (`getenv` y passerait
/// par la page de code ANSI et perdrait un « C:\Users\Josée »).
std::filesystem::path envPath(const char* name) {
#if defined(_WIN32)
  std::wstring wide(name, name + std::char_traits<char>::length(name));
  const wchar_t* value = _wgetenv(wide.c_str());
  return value == nullptr ? std::filesystem::path() : std::filesystem::path(value);
#else
  return utf8ToPath(env(name));
#endif
}

std::filesystem::path platformDefault() {
#if defined(_WIN32)
  // `app.getPath("appData")` = %APPDATA% (Roaming).
  std::filesystem::path base = envPath("APPDATA");
  if (base.empty()) base = envPath("USERPROFILE") / "AppData" / "Roaming";
  return base / kIdentifier;
#elif defined(__APPLE__)
  return envPath("HOME") / "Library" / "Application Support" / kIdentifier;
#else
  // XDG : un `XDG_DATA_HOME` relatif est invalide et serait résolu depuis le dossier courant.
  const std::filesystem::path xdg = envPath("XDG_DATA_HOME");
  if (!xdg.empty() && xdg.is_absolute()) return xdg / kIdentifier;
  return envPath("HOME") / ".local" / "share" / kIdentifier;
#endif
}

std::filesystem::path expandHome(const std::string& raw) {
  if (raw.rfind("~/", 0) == 0) return envPath("HOME") / utf8ToPath(raw.substr(2));
  return utf8ToPath(raw);
}

}  // namespace

std::filesystem::path resolveUserData(const AppOptions& options) {
  if (const auto it = options.extra.find("user-data"); it != options.extra.end() && !it->second.empty()) {
    return expandHome(it->second);
  }
  // (Une valeur ASCII en pratique : un dossier de banc.)
  if (const std::string profile = env("TENTACLE_ELECTRON_PROFILE"); !profile.empty()) return expandHome(profile);
  return platformDefault();
}

}  // namespace tentacle::offline
