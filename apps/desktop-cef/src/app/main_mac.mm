// Point d'entrée macOS du processus navigateur.
// Le framework CEF est LIÉ à l'exécutable (cmake/TentacleCef.cmake) : dyld le charge au
// lancement depuis Contents/Frameworks, avec l'édition de liens paresseuse (RAM, axe ram).

#import <Foundation/Foundation.h>

#include "app/app.h"

int main(int argc, char* argv[]) {
  @autoreleasepool {
    return tentacle::runApp(argc, argv);
  }
}
