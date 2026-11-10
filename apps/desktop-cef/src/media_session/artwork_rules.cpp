// Les règles pures de la pochette (testées seules) : quelles adresses le cœur télécharge,
// et ce qui est bien une image.
#include <cstring>

#include "media_session/artwork_fetch.h"

namespace tentacle::media_session {
namespace {

bool startsWith(const std::vector<uint8_t>& b, size_t at, const char* magic) {
  const size_t n = std::strlen(magic);
  return b.size() >= at + n && std::memcmp(b.data() + at, magic, n) == 0;
}

}  // namespace

std::string sniffImage(const std::vector<uint8_t>& b) {
  if (startsWith(b, 0, "\xFF\xD8\xFF")) return "image/jpeg";
  if (startsWith(b, 0, "\x89PNG\r\n\x1A\n")) return "image/png";
  if (startsWith(b, 0, "RIFF") && startsWith(b, 8, "WEBP")) return "image/webp";
  if (startsWith(b, 0, "GIF8")) return "image/gif";
  if (startsWith(b, 4, "ftypavif")) return "image/avif";
  if (startsWith(b, 4, "ftypheic") || startsWith(b, 4, "ftypmif1")) return "image/heic";
  return {};
}

bool artworkUrlAllowed(const std::string& url) {
  // http(s) : le serveur ou Jellyfin ; `tentacle://art/` : le cache des pochettes d'Octave
  // (même schéma que la page, servi par CEF). Rien d'autre (`file:`, `data:`…).
  return url.rfind("http://", 0) == 0 || url.rfind("https://", 0) == 0 || url.rfind("tentacle://art/", 0) == 0;
}

}  // namespace tentacle::media_session
