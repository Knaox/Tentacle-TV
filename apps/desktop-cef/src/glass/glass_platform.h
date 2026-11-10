#pragma once
// La couture d'OS du verre natif (`src/platform/<os>/glass_*`). Seul macOS 26 a un verre :
// ailleurs, `name()` suffit au verdict (« not-macos »), le reste n'est jamais appelé.
//
// Fil : le fil principal, sauf mention.

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "glass/availability.h"
#include "glass/backend.h"
#include "glass/luminance.h"

namespace tentacle {
struct AppContext;
class Compositor;
}  // namespace tentacle

namespace tentacle::glass::platform {

/// "darwin" | "linux" | "win32" — le `process.platform` d'Electron.
const char* name();
/// La version du système, « 26.6.2 » (`process.getSystemVersion()`) ; "" hors macOS.
std::string systemVersion();
/// Les deux classes PUBLIQUES du verre (`NSGlassEffectView`, `NSGlassEffectContainerView`)
/// sont-elles là, à l'exécution ?
RuntimeProbe probeRuntime();
/// Le verre du lecteur voit-il la vidéo posée sous la page ? Apple Silicon seulement, comme le
/// montage `fenetre` d'Electron (Intel : pas de verre du lecteur, ses GPU chauffent déjà).
bool refractsVideo();
/// Le verre natif de la fenêtre principale (sa racine passe par `Compositor::setUnderlay`) ;
/// nullptr si la fenêtre ne s'y prête pas.
std::unique_ptr<GlassBackend> createBackend(AppContext& ctx);

/// La page sous chaque boîte (points de la vue, `nullopt` : pas demandée) : la grille de
/// `gridSamples`, lue dans la DERNIÈRE image de la page (`WebLayer::retainLastFrame`), HORS du
/// fil principal ; `done` sur le fil principal, `nullopt` par boîte si rien n'est lisible.
using Grids = std::vector<std::optional<Samples>>;
void readPageGrids(Compositor* compositor, double viewWidthPt, std::vector<std::optional<Box>> boxes,
                   std::function<void(Grids)> done);

}  // namespace tentacle::glass::platform
