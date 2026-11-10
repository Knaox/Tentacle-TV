#pragma once
// Le verre natif de macOS 26 est-il disponible ? La DÉCISION, sans CEF ni AppKit — portée de
// `availability.ts` d'Electron, à l'identique.
//
// « Supporté » exige trois choses à la fois, et aucune ne se déduit des autres :
//  1. macOS 26 ou plus (`NSGlassEffectView` n'existe pas avant Tahoe) ;
//  2. la classe est là, à l'exécution — la seule preuve qui vaille ;
//  3. (Electron : le pont koffi s'est chargé.) Sous CEF, AppKit est lié au binaire : la sonde
//     ne rend jamais `load-failed`, la valeur reste pour le contrat des bancs.
//
// Le verdict est figé au démarrage et donné à la page par la configuration du shim :
// l'interrupteur de Réglages › Apparence ne doit jamais apparaître PUIS disparaître.
//
// Forçage des bancs : `TENTACLE_LIQUID_GLASS=off` simule un macOS sans verre (aucune vue,
// pont absent, option invisible) ; `native` saute la seule garde de version, jamais celle
// de la classe.

#include <functional>
#include <optional>
#include <string>
#include <string_view>

namespace tentacle::glass {

enum class Availability {
  Native,         // macOS 26+, `NSGlassEffectView` présente
  NotMacos,       // Windows, Linux
  ForcedOff,      // TENTACLE_LIQUID_GLASS=off
  UnsupportedOs,  // macOS d'avant 26
  MissingClass,   // version suffisante annoncée, classe absente à l'exécution
  LoadFailed,     // le pont natif n'a pas pu se charger (jamais sous CEF)
};

/// Ce que rend la sonde du runtime — appelée seulement si tout le reste passe.
enum class RuntimeProbe { Ok, MissingClass, LoadFailed };

struct AvailabilityInput {
  std::string platform;                // "darwin" | "linux" | "win32"
  std::string systemVersion;           // « 26.6.2 »
  std::optional<std::string> forced;   // TENTACLE_LIQUID_GLASS
  std::function<RuntimeProbe()> probe; // paresseuse : hors macOS, jamais appelée
};

/// macOS 26 et au-delà — et 16.x (Tahoe vu par un binaire lié à un SDK plus ancien).
bool osSupportsGlass(std::string_view systemVersion);

/// Le verdict : le forçage d'abord, puis la version, puis le runtime.
Availability decideLiquidGlass(const AvailabilityInput& input);

/// Le nom du verdict, celui d'Electron (« native », « not-macos »…).
const char* availabilityName(Availability availability);

}  // namespace tentacle::glass
