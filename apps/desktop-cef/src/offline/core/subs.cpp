#include "offline/core/subs.h"

#include <cctype>

#include "offline/core/meta.h"

namespace tentacle::offline {

std::string sanitizeTag(const std::string& tag) {
  // Par point de code, comme `[...tag]` : un caractère non ASCII n'est jamais retenu, et il
  // ne compte pas dans les 40 (seuls les retenus comptent : `filter` puis `slice`).
  std::string clean;
  for (const char c : tag) {
    const auto u = static_cast<unsigned char>(c);
    if (u < 0x80 && (std::isalnum(u) || c == '-')) {
      if (clean.size() < 40) clean.push_back(static_cast<char>(std::tolower(u)));
    }
  }
  return clean.empty() ? "und" : clean;
}

std::vector<SubtitleSpec> parseSpecs(const std::string& json) {
  const Json raw = parseJsonText(json);
  std::vector<SubtitleSpec> specs;
  if (!raw.is_array()) return specs;
  for (const Json& entry : raw) {
    const auto index = asInteger(jsonField(entry, "index"));
    const auto format = asString(jsonField(entry, "format"));
    const auto langTag = asString(jsonField(entry, "langTag"));
    if (!index || !format) continue;
    specs.push_back({*index, *format, langTag.value_or("und")});
  }
  return specs;
}

std::string subtitleRelPath(const std::string& itemId, const SubtitleSpec& spec) {
  return "media/" + itemId + "/subs/" + std::to_string(spec.index) + "-" + sanitizeTag(spec.langTag) + "." + spec.format;
}

}  // namespace tentacle::offline
