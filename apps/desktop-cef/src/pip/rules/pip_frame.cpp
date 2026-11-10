#include "pip/rules/pip_frame.h"

#include <algorithm>
#include <cmath>

namespace tentacle::pip {

Frame frameFor(Os os) {
  switch (os) {
    case Os::linuxDesktop: return {14, 4};
    case Os::windows: return {0, 0};
    case Os::macos: break;
  }
  return {4, 4};
}

Size windowSize(const Frame& frame, double videoWidth, double videoHeight) {
  const double inset = 2 * frame.inset();
  return {std::max(kMinVideoWidth, jsRound(videoWidth)) + inset,
          std::max(kMinVideoHeight, jsRound(videoHeight)) + inset};
}

double jsRound(double value) { return std::floor(value + 0.5); }

std::optional<Mode> parseMode(const std::string& name) {
  if (name == "floating") return Mode::floating;
  if (name == "docked") return Mode::docked;
  return std::nullopt;
}

const char* modeName(Mode mode) { return mode == Mode::docked ? "docked" : "floating"; }

std::optional<Gesture> parseGesture(const std::string& name) {
  if (name == "move") return Gesture::move;
  if (name == "top-left") return Gesture::topLeft;
  if (name == "top-right") return Gesture::topRight;
  if (name == "bottom-left") return Gesture::bottomLeft;
  if (name == "bottom-right") return Gesture::bottomRight;
  return std::nullopt;
}

const char* gestureName(Gesture gesture) {
  switch (gesture) {
    case Gesture::move: return "move";
    case Gesture::topLeft: return "top-left";
    case Gesture::topRight: return "top-right";
    case Gesture::bottomLeft: return "bottom-left";
    case Gesture::bottomRight: return "bottom-right";
  }
  return "move";
}

}  // namespace tentacle::pip
