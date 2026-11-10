#include "msix_rule.h"

namespace tentacle::display {

std::optional<std::string> msixInstallError(std::optional<int> state) {
  if (!state) return std::string("install-state-null");
  switch (*state) {
    case kMsixStateCompleted: return std::nullopt;
    case 4: return std::string("install-canceled");
    case 6: return std::string("install-low-battery");
    case 7:
    case 8: return std::string("install-wifi-required");
    default: return "install-state-" + std::to_string(*state);
  }
}

bool opensStorePage(const std::string& code) {
  return code != "install-canceled" && code != "install-low-battery" && code != "install-wifi-required";
}

}  // namespace tentacle::display
