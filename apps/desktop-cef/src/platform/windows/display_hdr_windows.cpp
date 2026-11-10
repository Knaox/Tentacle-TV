// Windows : bascule du mode HDR de l'écran le temps d'une lecture — portage de
// `video/hdr.ts` d'Electron (même API, mêmes règles, même mémoire par cible).
//
// Pourquoi (mesuré par Electron sur le poste de test) : écran en SDR + film HDR transmis =
// image quasi noire ; écran laissé en HDR = tout le contenu SDR du bureau délavé. On active
// donc le HDR à l'entrée d'un film qui en a besoin (si la page l'autorise) et on rend l'écran
// à son état d'origine en sortant.
//
// L'API : `DisplayConfigSetDeviceInfo` avec SET_ADVANCED_COLOR_STATE, la voie documentée des
// utilitaires de bascule ; la cible d'affichage se retrouve par `QueryDisplayConfig`. Les
// structures sont redéclarées ici (même disposition que le SDK) : les en-têtes d'avant le SDK
// 17763 et ceux de mingw-w64 ne les ont pas tous.

#include <windows.h>

#include <optional>
#include <vector>

#include "platform/display_hdr.h"

namespace tentacle::platform {
namespace {

constexpr auto kGetAdvancedColorInfo = static_cast<DISPLAYCONFIG_DEVICE_INFO_TYPE>(9);
constexpr auto kSetAdvancedColorState = static_cast<DISPLAYCONFIG_DEVICE_INFO_TYPE>(10);

struct AdvancedColorInfo {  // DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO (32 octets)
  DISPLAYCONFIG_DEVICE_INFO_HEADER header;
  UINT32 value;  // bit 0 : pris en charge ; bit 1 : activé
  INT32 colorEncoding;
  UINT32 bitsPerColorChannel;
};
struct AdvancedColorState {  // DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE (24 octets)
  DISPLAYCONFIG_DEVICE_INFO_HEADER header;
  UINT32 value;  // bit 0 : activer
};
static_assert(sizeof(AdvancedColorInfo) == 32 && sizeof(AdvancedColorState) == 24);

struct Target {
  LUID adapter{};
  UINT32 id = 0;
};

struct State {
  bool supported = false, active = false;
};

// Cibles d'affichage actives ; vide si l'énumération échoue.
std::vector<Target> activeTargets() {
  UINT32 pathCount = 0, modeCount = 0;
  if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &pathCount, &modeCount) != ERROR_SUCCESS) return {};
  std::vector<DISPLAYCONFIG_PATH_INFO> paths(pathCount);
  std::vector<DISPLAYCONFIG_MODE_INFO> modes(modeCount);
  if (QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, &pathCount, paths.data(), &modeCount, modes.data(), nullptr) !=
      ERROR_SUCCESS) {
    return {};
  }
  std::vector<Target> out;
  for (UINT32 i = 0; i < pathCount; ++i) out.push_back({paths[i].targetInfo.adapterId, paths[i].targetInfo.id});
  return out;
}

bool readState(const Target& t, State& out) {
  AdvancedColorInfo info{};
  info.header.type = kGetAdvancedColorInfo;
  info.header.size = sizeof info;
  info.header.adapterId = t.adapter;
  info.header.id = t.id;
  if (DisplayConfigGetDeviceInfo(&info.header) != ERROR_SUCCESS) return false;
  out.supported = (info.value & 1) != 0;
  out.active = (info.value & 2) != 0;
  return true;
}

bool writeState(const Target& t, bool active) {
  AdvancedColorState set{};
  set.header.type = kSetAdvancedColorState;
  set.header.size = sizeof set;
  set.header.adapterId = t.adapter;
  set.header.id = t.id;
  set.value = active ? 1 : 0;
  return DisplayConfigSetDeviceInfo(&set.header) == ERROR_SUCCESS;
}

bool sameTarget(const Target& a, const Target& b) {
  return a.id == b.id && a.adapter.LowPart == b.adapter.LowPart && a.adapter.HighPart == b.adapter.HighPart;
}

// État d'origine, retenu PAR CIBLE pour être rendu tel quel : un poste à deux écrans peut en
// avoir un en HDR et l'autre non. Absent tant que nous n'avons rien basculé.
struct Remembered {
  Target target;
  bool active;
};
std::optional<std::vector<Remembered>> g_before;

}  // namespace

DisplayHdrProbe probeDisplayHdr(void*) {
  DisplayHdrProbe p;
  for (const Target& t : activeTargets()) {
    State s;
    if (!readState(t, s)) continue;
    p.supported = p.supported || s.supported;
    p.active = p.active || s.active;
  }
  return p;
}

bool displayHdrNegotiated() { return true; }

bool displayHdrToggled() { return g_before.has_value(); }

bool enableDisplayHdr() {
  const auto targets = activeTargets();
  if (targets.empty()) return false;
  // ⚠️ (hdr.ts) la mémoire n'est écrite qu'à la PREMIÈRE bascule, mais l'activation est
  // retentée à chaque appel : une lecture précédente qui n'aurait pas rendu l'écran (app tuée)
  // ne doit pas faire répondre « ok » sans rien basculer.
  const bool first = !g_before;
  std::vector<Remembered> memory = first ? std::vector<Remembered>{} : *g_before;
  bool atLeastOne = false;
  for (const Target& t : targets) {
    State s;
    if (!readState(t, s) || !s.supported) continue;
    if (first) memory.push_back({t, s.active});
    if (s.active || writeState(t, true)) atLeastOne = true;
  }
  if (memory.empty()) return false;
  if (first) g_before = std::move(memory);
  return atLeastOne;
}

void restoreDisplayHdr() {
  if (!g_before) return;
  const auto targets = activeTargets();
  for (const Remembered& r : *g_before) {
    for (const Target& t : targets) {
      State s;
      if (sameTarget(t, r.target) && readState(t, s) && s.active != r.active) writeState(t, r.active);
    }
  }
  g_before.reset();
}

}  // namespace tentacle::platform
