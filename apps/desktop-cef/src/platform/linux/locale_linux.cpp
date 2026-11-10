#include "platform/linux/locale_linux.h"

#include <algorithm>
#include <cctype>
#include <sstream>
#include <vector>

namespace tentacle::platform {
namespace {

// « fr_CH.UTF-8@euro » → « fr-CH » ; « C », « POSIX », vide → "".
std::string toBcp47(std::string tag) {
  tag = tag.substr(0, tag.find_first_of(".@"));
  if (tag.empty() || tag == "C" || tag == "POSIX") return "";
  std::replace(tag.begin(), tag.end(), '_', '-');
  // Langue en minuscules, région en majuscules (« fr-ch » → « fr-CH »).
  const auto dash = tag.find('-');
  for (size_t i = 0; i < tag.size(); ++i) {
    const char c = tag[i];
    tag[i] = char((dash != std::string::npos && i > dash) ? std::toupper(c) : std::tolower(c));
  }
  return tag;
}

}  // namespace

std::string acceptLanguagesFrom(
    const std::function<std::optional<std::string>(const char* name)>& env) {
  std::vector<std::string> tags;
  // LANGUAGE n'a d'effet (gettext) que si la locale n'est pas « C » : on suit la même règle.
  std::string locale;
  for (const char* name : {"LC_ALL", "LC_MESSAGES", "LANG"}) {
    if (auto v = env(name); v && !v->empty()) {
      locale = *v;
      break;
    }
  }
  if (auto list = env("LANGUAGE"); list && !list->empty() && !toBcp47(locale).empty()) {
    std::stringstream in(*list);
    for (std::string item; std::getline(in, item, ':');) tags.push_back(toBcp47(item));
  }
  tags.push_back(toBcp47(locale));
  std::vector<std::string> out;
  auto add = [&](const std::string& t) {
    if (!t.empty() && std::find(out.begin(), out.end(), t) == out.end()) out.push_back(t);
  };
  for (const auto& t : tags) {
    if (t.empty()) continue;
    add(t);
    if (auto dash = t.find('-'); dash != std::string::npos) add(t.substr(0, dash));
  }
  std::string joined;
  for (const auto& t : out) joined += (joined.empty() ? "" : ",") + t;
  return joined;
}

}  // namespace tentacle::platform
