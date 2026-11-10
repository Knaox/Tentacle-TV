#include "shell/external_url.h"

#include <SDL3/SDL.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "include/cef_parser.h"
#include "shell/navigation_rule.h"

namespace tentacle {

bool openExternalSafely(const std::string& url) {
  // `new URL(rawUrl)` : une URL illisible est refusée ; lisible, elle part sous sa forme
  // canonique (`parsed.toString()`), jamais telle que la page l'a écrite.
  CefURLParts parts;
  if (!nav::externalSchemeAllowed(url) || !CefParseURL(url, parts)) {
    std::fprintf(stderr, "[externe] refusé : %s\n", url.c_str());
    return false;
  }
  const std::string canonical = CefString(&parts.spec).ToString();
  if (!nav::externalSchemeAllowed(canonical)) return false;
  const char* mode = std::getenv("TENTACLE_OPEN_EXTERNAL");
  if (mode && std::strcmp(mode, "log") == 0) {
    std::fprintf(stderr, "[externe] (banc, non ouvert) %s\n", canonical.c_str());
    return true;
  }
  std::fprintf(stderr, "[externe] %s\n", canonical.c_str());
  return SDL_OpenURL(canonical.c_str());
}

}  // namespace tentacle
