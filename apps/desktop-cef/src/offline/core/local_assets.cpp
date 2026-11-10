#include "offline/core/local_assets.h"

#include <algorithm>
#include <cctype>

namespace tentacle::offline {

std::optional<std::string> localAssetMime(const std::string& rel) {
  // `path.extname` : depuis le dernier point du dernier composant, sauf en tête de nom.
  const size_t slash = rel.find_last_of("/\\");
  const std::string name = slash == std::string::npos ? rel : rel.substr(slash + 1);
  const size_t dot = name.rfind('.');
  if (dot == std::string::npos || dot == 0) return std::nullopt;
  std::string ext = name.substr(dot);
  std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
  if (ext == ".png") return "image/png";
  if (ext == ".webp") return "image/webp";
  if (ext == ".json") return "application/json";
  if (ext == ".srt" || ext == ".vtt" || ext == ".ass" || ext == ".ssa") return "text/plain; charset=utf-8";
  return std::nullopt;
}

}  // namespace tentacle::offline
