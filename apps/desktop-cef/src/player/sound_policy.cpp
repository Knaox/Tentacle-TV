#include "player/sound_policy.h"

#include <cstdlib>
#include <cstring>

namespace tentacle::sound {
namespace {

bool flag(const char* name) {
  const char* v = std::getenv(name);
  return v && *v && std::strcmp(v, "0") != 0;
}

}  // namespace

Mode mode() {
  if (flag("TENTACLE_MUTE")) return Mode::Muted;
  if (flag("TENTACLE_SOUND_PROBE")) return Mode::Probe;
  return Mode::Real;
}

void forceMute() {
#if defined(_WIN32)
  _putenv_s("TENTACLE_MUTE", "1");
#else
  setenv("TENTACLE_MUTE", "1", 1);
#endif
}

const char* nativeOutput() {
#if defined(__APPLE__)
  return "coreaudio";
#elif defined(_WIN32)
  return "wasapi";
#else
  // Liste de mpv : le premier qui s'ouvre gagne (bureau PipeWire, puis Pulse, puis ALSA nu).
  return "pipewire,pulse,alsa";
#endif
}

std::vector<std::pair<std::string, std::string>> forcedOptions(const std::string& callerAo) {
  switch (mode()) {
    case Mode::Muted:
      return {{"ao", "null"}, {"mute", "yes"}};
    case Mode::Probe:
      // `af` REMPLACE la chaîne de l'appelant (aucun appelant n'en pose) ; `af-append` n'est
      // pas une option pour `mpv_set_option_string` (« option not found », mesuré).
      return {{"ao", nativeOutput()}, {"mute", "yes"}, {"af", "lavfi=[volume=volume=0]"}};
    case Mode::Real:
      break;
  }
  return {{"ao", callerAo.empty() ? nativeOutput() : callerAo}};
}

nlohmann::json guardMute(const nlohmann::json& args) {
  if (!silent() || !args.is_array() || args.size() < 2 || args[1] != "mute") return args;
  if (args[0] == "set" || args[0] == "cycle") return nlohmann::json::array({"set", "mute", "yes"});
  return args;
}

}  // namespace tentacle::sound
