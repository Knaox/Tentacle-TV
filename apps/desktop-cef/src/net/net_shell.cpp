// L'axe réseau dans l'app (voir net_shell.h).

#include "net/net_shell.h"

#include "app/app.h"
#include "schemes/art_scheme.h"
#include "shell/paths.h"

namespace tentacle::reseau {

void install(AppContext& ctx) {
  // Le cache des pochettes d'Octave : celui d'Electron (<userData>/octave-art).
  schemes::registerArtScheme(paths::userData() / "octave-art");
}

void shutdown() {}

}  // namespace tentacle::reseau
