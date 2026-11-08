// Point d'entrée des 5 helpers CEF (GPU, Renderer, Plugin, Alerts, générique).
// Rien de SDL ici : le helper ne fait que CefExecuteProcess. Le framework CEF est lié
// (cmake/TentacleCef.cmake, chemin ajusté par cmake/MacBundle.cmake).

#import <Foundation/Foundation.h>

#include "include/cef_app.h"
#include "shell/renderer_app.h"

int main(int argc, char* argv[]) {
  @autoreleasepool {
    CefMainArgs args(argc, argv);
    return CefExecuteProcess(args, tentacle::createHelperApp(), nullptr);
  }
}
