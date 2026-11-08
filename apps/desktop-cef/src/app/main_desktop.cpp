// Point d'entrée Linux/Windows (non construit sur ce Mac) : un seul exécutable sert aussi
// de sous-processus CEF (pas de paquets helpers hors macOS).

#include "app/app.h"
#include "include/cef_app.h"
#include "shell/renderer_app.h"

int main(int argc, char* argv[]) {
#ifdef _WIN32
  CefMainArgs args(GetModuleHandle(nullptr));
#else
  CefMainArgs args(argc, argv);
#endif
  const int code = CefExecuteProcess(args, tentacle::createHelperApp(), nullptr);
  if (code >= 0) return code;  // nous étions un sous-processus
  return tentacle::runApp(argc, argv);
}
