#include "app/args.h"

#include <cstdio>
#include <cstdlib>

namespace tentacle {

std::string cacheRoot() {
  if (const char* c = std::getenv("TENTACLE_CEF_CACHE"); c && *c) return c;
  const char* home = std::getenv("HOME");
  if (!home || !*home) home = std::getenv("USERPROFILE");  // Windows : pas de HOME hors Git Bash
  return std::string(home ? home : ".") + "/.cache/tentacle-cef";
}

bool parseArgs(int argc, char** argv, AppOptions& out) {
  for (int i = 1; i < argc; ++i) {
    std::string a = argv[i];
    if (a.rfind("--", 0) != 0) continue;  // arguments internes de macOS (-psn_…, -NS…)
    std::string key = a.substr(2), value;
    if (auto eq = key.find('='); eq != std::string::npos) {
      value = key.substr(eq + 1);
      key = key.substr(0, eq);
    } else if (key != "background" && key != "mute" && i + 1 < argc && argv[i + 1][0] != '-') {
      // --background et --mute sont des drapeaux : ils ne prennent jamais l'argument suivant.
      value = argv[++i];
    }
    if (key == "url") {
      out.url = value;
    } else if (key == "devtools-port") {
      out.devtoolsPort = std::atoi(value.c_str());
    } else if (key == "profile") {
      out.profileDir = value;
    } else if (key == "frame-rate") {
      out.frameRate = std::atoi(value.c_str());
    } else if (key == "fake-video") {
      if (value == "off") {
        out.fakeVideo.reset();
      } else if (value.rfind("edr", 0) == 0) {
        out.fakeVideoEdr = value.size() > 4 ? float(std::atof(value.c_str() + 4)) : 4.0f;
      } else {
        out.fakeVideo = uint32_t(std::strtoul(value.c_str(), nullptr, 16));
      }
    } else if (key == "size") {
      if (std::sscanf(value.c_str(), "%dx%d", &out.width, &out.height) != 2) {
        std::fprintf(stderr, "--size attend LxH (ex. 1280x800)\n");
        return false;
      }
    } else if (key == "background") {
      out.background = true;
    } else {
      out.extra[key] = value;
    }
  }
  if (out.profileDir.empty()) out.profileDir = cacheRoot() + "/profiles/socle";
  return true;
}

}  // namespace tentacle
