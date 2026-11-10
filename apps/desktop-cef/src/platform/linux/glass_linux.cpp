// Le verre natif sous Linux : il n'existe pas (macOS 26 seulement, comme sous Electron). Le
// verdict s'arrête à « not-macos » sur `name()` ; le reste n'est jamais appelé.
#include "glass/glass_platform.h"

namespace tentacle::glass::platform {

const char* name() { return "linux"; }
std::string systemVersion() { return {}; }
RuntimeProbe probeRuntime() { return RuntimeProbe::MissingClass; }
bool refractsVideo() { return false; }
std::unique_ptr<GlassBackend> createBackend(AppContext&) { return nullptr; }
void readPageGrids(Compositor*, double, std::vector<std::optional<Box>> boxes, std::function<void(Grids)> done) {
  done(Grids(boxes.size()));
}

}  // namespace tentacle::glass::platform
