// Le verre natif sous Windows : il n'existe pas (macOS 26 seulement, comme sous Electron). Le
// verdict s'arrête à « not-macos » sur `name()` ; le reste n'est jamais appelé.
#include "glass/glass_platform.h"

namespace tentacle::glass::platform {

const char* name() { return "win32"; }
std::string systemVersion() { return {}; }
RuntimeProbe probeRuntime() { return RuntimeProbe::MissingClass; }
bool refractsVideo() { return false; }
int liveNativeViews() { return -1; }
bool windowComposited(void*) { return false; }
std::unique_ptr<GlassBackend> createBackend(AppContext&) { return nullptr; }
void readPageGrids(Compositor*, double, std::vector<std::optional<Box>> boxes, std::function<void(Grids)> done) {
  done(Grids(boxes.size()));
}

}  // namespace tentacle::glass::platform
