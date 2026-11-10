// La sonde de surface (DÉVELOPPEMENT, macOS) : ce que l'OS fournit — headroom EDR de l'écran de
// la fenêtre, numéro de fenêtre, capture. Défini dans `src/platform/macos/video_probe_mac.mm`.
#pragma once

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace tentacle::probe {

struct EdrState {
  double current = 0;    // plage étendue accordée en ce moment (révisable : rampe de quelques secondes)
  double potential = 0;  // ce que l'écran saurait donner
};
struct CaptureResult {
  std::vector<uint8_t> bytes;  // BMP
  std::optional<std::string> error;
};

EdrState readEdr(void* nsWindow);
int windowNumber(void* nsWindow);
// `done` depuis un fil de travail (jamais le fil principal).
void captureWindow(int number, std::function<void(CaptureResult)> done);

}  // namespace tentacle::probe
