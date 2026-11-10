#pragma once
// Le PiP (image dans l'image), règles pures : les types communs.
//
// Portage à l'identique de la coquille Electron (`apps/desktop-electron/src/main/pip/`). Tout
// est en POINTS logiques, origine en haut à gauche de l'écran principal (celle d'Electron), et
// porte sur la FENÊTRE PiP — vidéo, liseré et ombre (`pip_frame.h`).
//
// Aucun CEF, aucun SDL, aucun OS ici : ces règles se testent seules (`tests/pip_tests.cpp`).

#include <optional>
#include <string>

namespace tentacle::pip {

struct Box {
  double x = 0, y = 0, width = 0, height = 0;
  bool operator==(const Box&) const = default;
};

struct Point {
  double x = 0, y = 0;
  bool operator==(const Point&) const = default;
};

struct Size {
  double width = 0, height = 0;
  bool operator==(const Size&) const = default;
};

/// Le cadre autour de la vidéo, de chaque côté : liseré opaque et marge d'ombre transparente.
struct Frame {
  double shadow = 0;
  double bezel = 0;
  /// De la fenêtre PiP à la vidéo, de chaque côté.
  double inset() const { return shadow + bezel; }
};

/// Flottant (au-dessus de tout, sur tous les bureaux) ou ancré (au coin de l'application).
enum class Mode { floating, docked };

/// Le geste que la page annonce (`pip_gesture`) et que la coquille exécute.
enum class Gesture { move, topLeft, topRight, bottomLeft, bottomRight };

/// Le système : les valeurs du cadre en dépendent, comme chez Electron.
// (`linux` est une macro de GCC en gnu++20 : jamais un énumérateur de ce nom.)
enum class Os { macos, linuxDesktop, windows };

/// Le système de CE binaire.
constexpr Os currentOs() {
#if defined(__APPLE__)
  return Os::macos;
#elif defined(_WIN32)
  return Os::windows;
#else
  return Os::linuxDesktop;
#endif
}

/// Noms de la page (`"floating"`, `"docked"`, `"move"`, `"top-left"`…) — ils traversent l'IPC.
std::optional<Mode> parseMode(const std::string& name);
const char* modeName(Mode mode);
std::optional<Gesture> parseGesture(const std::string& name);
const char* gestureName(Gesture gesture);

/// Mêmes coordonnées entières que `Math.round` de JavaScript (moitié vers +∞).
double jsRound(double value);

}  // namespace tentacle::pip
