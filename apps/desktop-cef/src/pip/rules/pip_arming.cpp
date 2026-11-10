#include "pip/rules/pip_arming.h"

#include "pip/rules/pip_captions.h"
#include "pip/rules/pip_motion.h"

namespace tentacle::pip {

void Arming::arm(Mode mode, double width, double height, double nowMs) {
  armed_ = Armed{mode, width, height, nowMs + kArmDelayMs};
}

OpenDecision Arming::decide(const std::string& frameName, const std::string& url, double nowMs,
                            bool pipAlreadyOpen, const Frame& frame) {
  OpenDecision d;
  if (frameName != kFrameName) return d;
  const std::optional<Armed> wanted = armed_;
  armed_.reset();
  if (url != "about:blank" || !wanted || nowMs > wanted->untilMs || pipAlreadyOpen) {
    d.kind = OpenDecision::Kind::deny;
    return d;
  }
  d.kind = OpenDecision::Kind::allow;
  d.mode = wanted->mode;
  d.videoWidth = wanted->width;
  d.videoHeight = wanted->height;
  d.window = windowSize(frame, wanted->width, wanted->height);
  d.aspect = wanted->width / wanted->height;
  return d;
}

std::string birthCaption(Mode mode, bool shellDrivesPip, bool reducedMotion) {
  if (shellDrivesPip || reducedMotion) return caption(mode, std::nullopt);
  return commandCaption(mode, {Command::Kind::enter, kShrinkMs});
}

}  // namespace tentacle::pip
