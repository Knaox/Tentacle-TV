#include "lifecycle/app_links.h"

#include <cctype>

namespace tentacle::lifecycle {

std::optional<std::string> appLinkOf(std::string_view raw) {
  if (raw.size() > kAppLinkMaxLength || raw.size() < kAppLinkPrefix.size()) return std::nullopt;
  // `raw.toLowerCase().startsWith(PREFIX)` : le préfixe sans égard à la casse, le lien rendu tel quel.
  for (size_t i = 0; i < kAppLinkPrefix.size(); ++i) {
    if (std::tolower(static_cast<unsigned char>(raw[i])) != kAppLinkPrefix[i]) return std::nullopt;
  }
  return std::string(raw);
}

std::optional<std::string> appLinkFromArgv(const std::vector<std::string>& argv) {
  for (const auto& arg : argv) {
    if (auto link = appLinkOf(arg)) return link;
  }
  return std::nullopt;
}

bool AppLinks::deliver(std::string_view raw, const AppLinkPage& page) {
  auto link = appLinkOf(raw);
  if (!link) return false;
  pending_ = *link;
  if (page.ready && page.ready()) {
    if (page.send) page.send(*link);
    pending_.reset();
    if (page.focus) page.focus();
  }
  return true;
}

void AppLinks::keepLaunchLink(const std::vector<std::string>& argv) {
  if (auto link = appLinkFromArgv(argv)) pending_ = std::move(link);
}

std::optional<std::string> AppLinks::take() {
  auto link = std::move(pending_);
  pending_.reset();
  return link;
}

}  // namespace tentacle::lifecycle
