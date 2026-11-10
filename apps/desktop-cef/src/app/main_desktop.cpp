// Point d'entrée Linux/Windows : un seul exécutable sert aussi de sous-processus CEF (pas de
// paquets helpers hors macOS).
//
// Linux : la session graphique (Wayland ou X11, graphics_session.h) est décidée ICI, avant
// CEF et SDL, et donnée à Chromium par la ligne de commande (--ozone-platform) : le
// processus principal choisit son Ozone en lisant argv, un drapeau posé plus tard n'aurait
// d'effet que sur ses enfants (piège mesuré sous Electron 43, graphicsSession.ts).

#include <string>
#include <vector>

#include "app/app.h"
#include "include/cef_app.h"
#include "shell/renderer_app.h"

#ifdef __linux__
#include <map>

#include "platform/linux/graphics_session.h"
#include "shell/paths.h"

namespace {

// --user-data (« --clé=valeur » ou « --clé valeur », comme args.cpp) : la session se lit
// dans le dossier de données, avant que runApp n'analyse le reste.
void configureUserData(int argc, char* argv[]) {
  const std::string key = "--user-data";
  for (int i = 1; i < argc; ++i) {
    const std::string a = argv[i];
    if (a.rfind(key + "=", 0) == 0) {
      tentacle::paths::configure({{"user-data", a.substr(key.size() + 1)}});
    } else if (a == key && i + 1 < argc) {
      tentacle::paths::configure({{"user-data", argv[i + 1]}});
    }
  }
}

}  // namespace
#endif

int main(int argc, char* argv[]) {
#ifdef _WIN32
  CefMainArgs args(GetModuleHandle(nullptr));
#else
  CefMainArgs args(argc, argv);
#endif
  const int code = CefExecuteProcess(args, tentacle::createHelperApp(), nullptr);
  if (code >= 0) return code;  // nous étions un sous-processus
#ifdef __linux__
  configureUserData(argc, argv);
  const auto& session = tentacle::platform::startupSession();
  std::vector<std::string> extra = {
      std::string("--ozone-platform=") + tentacle::platform::displayServerName(session.montage),
      // Cookies de CEF chiffrés par une clé locale : jamais d'invite du trousseau (GNOME
      // Keyring, KWallet) — l'équivalent de use-mock-keychain sous macOS.
      "--password-store=basic",
  };
  std::vector<char*> argvx(argv, argv + argc);
  for (auto& s : extra) argvx.push_back(s.data());
  argvx.push_back(nullptr);
  return tentacle::runApp(int(argvx.size() - 1), argvx.data());
#else
  return tentacle::runApp(argc, argv);
#endif
}
