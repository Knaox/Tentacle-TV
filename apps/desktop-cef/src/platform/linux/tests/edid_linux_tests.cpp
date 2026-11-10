// EDID HDR : portage de apps/desktop-electron/src/main/linux/edidHdr.test.ts.

#include <cstdio>
#include <filesystem>
#include <fstream>
#include <vector>

#include "platform/linux/edid_linux.h"

extern int linuxRuleFailures;
using tentacle::platform::edidSupportsHdr;
using tentacle::platform::hdrDisplayConnected;

namespace {

int failures = 0;
void check(bool ok, const char* what) {
  if (!ok) {
    std::fprintf(stderr, "ÉCHEC : %s\n", what);
    ++failures;
  }
}

// Un EDID de base suivi d'une extension CTA-861 portant `blocks`.
std::vector<uint8_t> edidWith(const std::vector<std::vector<uint8_t>>& blocks) {
  std::vector<uint8_t> e(256, 0);
  e[126] = 1;
  e[128] = 0x02;
  e[129] = 0x03;
  size_t at = 132;
  for (const auto& b : blocks)
    for (uint8_t byte : b) e[at++] = byte;
  e[130] = uint8_t(at - 128);
  return e;
}
std::vector<uint8_t> hdrBlock(uint8_t eotf) { return {(7 << 5) | 3, 6, eotf, 0x01}; }
const std::vector<uint8_t> kAudio = {(1 << 5) | 3, 0x09, 0x07, 0x07};

void writeConnector(const std::filesystem::path& root, const char* name, const char* status,
                    const std::vector<uint8_t>& edid) {
  std::filesystem::create_directories(root / name);
  std::ofstream(root / name / "status") << status << "\n";
  std::ofstream(root / name / "edid", std::ios::binary).write(reinterpret_cast<const char*>(edid.data()), std::streamsize(edid.size()));
}

}  // namespace

void edidTests() {
  check(edidSupportsHdr(edidWith({kAudio, hdrBlock(0b0101)})), "un écran qui annonce PQ est HDR");
  check(edidSupportsHdr(edidWith({hdrBlock(0b1001)})), "HLG seul suffit");
  check(!edidSupportsHdr(edidWith({hdrBlock(0b0001)})), "gamma SDR seul : pas HDR");
  check(!edidSupportsHdr(std::vector<uint8_t>(128, 0)), "sans extension CTA : pas HDR");
  check(!edidSupportsHdr(std::vector<uint8_t>(10, 0)), "EDID tronqué : pas HDR");
  check(!edidSupportsHdr(edidWith({kAudio})), "bloc audio seul : pas HDR");

  const auto root = std::filesystem::temp_directory_path() / "tentacle-drm-tests";
  std::filesystem::remove_all(root);
  writeConnector(root, "card1-DP-1", "disconnected", edidWith({hdrBlock(0b0100)}));
  writeConnector(root, "card1-HDMI-A-1", "connected", edidWith({kAudio}));
  check(!hdrDisplayConnected(root.string()), "ne compte que les écrans BRANCHÉS");
  writeConnector(root, "card1-DP-2", "connected", edidWith({hdrBlock(0b0100)}));
  check(hdrDisplayConnected(root.string()), "un seul écran HDR branché suffit");
  std::filesystem::remove_all(root);
  check(!hdrDisplayConnected("/chemin/qui/n/existe/pas"), "dossier absent : pas HDR");
  if (failures) std::fprintf(stderr, "EDID : %d échec(s)\n", failures);
  linuxRuleFailures += failures;
}
