#include "pip/rules/pip_captions.h"

#include <algorithm>

namespace tentacle::pip {
namespace {

const char* captionOf(Mode mode) { return mode == Mode::docked ? kCaptionDocked : kCaptionFloating; }

std::string integer(double value) {
  return std::to_string(static_cast<long long>(jsRound(value)));
}

}  // namespace

std::string caption(Mode mode, std::optional<Gesture> gesture, std::optional<Point> grab) {
  std::string out = captionOf(mode);
  if (!gesture) return out;
  out += " [";
  out += gestureName(*gesture);
  if (*gesture == Gesture::move && grab) out += " " + integer(grab->x) + " " + integer(grab->y);
  out += "]";
  return out;
}

std::string commandCaption(Mode mode, const Command& command) {
  const std::string ms = integer(std::max(0.0, jsRound(command.ms)));
  std::string body;
  switch (command.kind) {
    case Command::Kind::size:
      body = "size " + integer(command.width) + " " + integer(command.height) + " " + ms;
      break;
    case Command::Kind::restore: body = "restore " + ms; break;
    case Command::Kind::enter: body = "enter " + ms; break;
  }
  return std::string(captionOf(mode)) + " [" + body + "]";
}

}  // namespace tentacle::pip
