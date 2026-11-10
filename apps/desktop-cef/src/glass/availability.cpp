#include "glass/availability.h"

#include <cctype>
#include <cstdlib>

namespace tentacle::glass {
namespace {

/// `Number.parseInt(texte, 10)` : blancs de tête, signe, chiffres ; rien de lisible → nul.
std::optional<long> parseIntLikeJs(std::string_view text) {
  size_t i = 0;
  while (i < text.size() && std::isspace(static_cast<unsigned char>(text[i]))) ++i;
  bool negative = false;
  if (i < text.size() && (text[i] == '+' || text[i] == '-')) negative = text[i++] == '-';
  long value = 0;
  size_t digits = 0;
  while (i < text.size() && std::isdigit(static_cast<unsigned char>(text[i]))) {
    value = value * 10 + (text[i++] - '0');
    if (++digits > 9) break;  // une version n'a pas dix chiffres
  }
  if (digits == 0) return std::nullopt;
  return negative ? -value : value;
}

/// `trim().toLowerCase()` de JavaScript, pour l'ASCII (les seules valeurs qui décident).
std::string normalized(const std::string& raw) {
  size_t begin = 0, end = raw.size();
  while (begin < end && std::isspace(static_cast<unsigned char>(raw[begin]))) ++begin;
  while (end > begin && std::isspace(static_cast<unsigned char>(raw[end - 1]))) --end;
  std::string out = raw.substr(begin, end - begin);
  for (char& c : out) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return out;
}

}  // namespace

// ⚠️ 16 n'est pas une coquille. Comme Big Sur se disait « 10.16 » aux binaires liés à un SDK
// plus ancien, Tahoe peut se présenter en « 16.0 ». Aucun macOS 16 n'a jamais existé :
// l'accepter ne laisse rien passer de faux, et la présence de la classe reste la vraie garde.
bool osSupportsGlass(std::string_view systemVersion) {
  const auto dot = systemVersion.find('.');
  const auto major = parseIntLikeJs(systemVersion.substr(0, dot));
  if (!major) return false;
  return *major >= 26 || *major == 16;
}

Availability decideLiquidGlass(const AvailabilityInput& input) {
  if (input.platform != "darwin") return Availability::NotMacos;
  const std::string forced = normalized(input.forced.value_or(""));
  if (forced == "off") return Availability::ForcedOff;
  if (forced != "native" && !osSupportsGlass(input.systemVersion)) return Availability::UnsupportedOs;
  const RuntimeProbe probed = input.probe ? input.probe() : RuntimeProbe::LoadFailed;
  switch (probed) {
    case RuntimeProbe::Ok: return Availability::Native;
    case RuntimeProbe::MissingClass: return Availability::MissingClass;
    case RuntimeProbe::LoadFailed: return Availability::LoadFailed;
  }
  return Availability::LoadFailed;
}

const char* availabilityName(Availability availability) {
  switch (availability) {
    case Availability::Native: return "native";
    case Availability::NotMacos: return "not-macos";
    case Availability::ForcedOff: return "forced-off";
    case Availability::UnsupportedOs: return "unsupported-os";
    case Availability::MissingClass: return "missing-class";
    case Availability::LoadFailed: return "load-failed";
  }
  return "load-failed";
}

}  // namespace tentacle::glass
