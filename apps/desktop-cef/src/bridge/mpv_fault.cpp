#include "mpv_fault.h"

#include <cstdio>
#include <cstdlib>

namespace bridge {

std::optional<MpvFault> parseMpvFault(const std::string& text) {
  if (text == "off" || text.empty()) return MpvFault::Off;
  if (text == "init") return MpvFault::Init;
  if (text == "stall") return MpvFault::Stall;
  if (text == "load") return MpvFault::Load;
  if (text == "fatal") return MpvFault::Fatal;
  if (text == "absent") return MpvFault::Absent;
  return std::nullopt;
}

const char* mpvFaultName(MpvFault fault) {
  switch (fault) {
    case MpvFault::Init: return "init";
    case MpvFault::Stall: return "stall";
    case MpvFault::Load: return "load";
    case MpvFault::Fatal: return "fatal";
    case MpvFault::Absent: return "absent";
    case MpvFault::Off: break;
  }
  return "off";
}

MpvFault mpvFaultFromEnv() {
  const char* raw = std::getenv("TENTACLE_MPV_FAIL");
  if (!raw || !*raw) return MpvFault::Off;
  const auto fault = parseMpvFault(raw);
  if (!fault) {
    std::fprintf(stderr, "[pont] TENTACLE_MPV_FAIL=%s ignoree (off, init, stall, load, fatal, absent)\n", raw);
    return MpvFault::Off;
  }
  if (*fault != MpvFault::Off) std::fprintf(stderr, "[pont] panne du lecteur PROVOQUEE : %s (TENTACLE_MPV_FAIL)\n", mpvFaultName(*fault));
  return *fault;
}

}  // namespace bridge
