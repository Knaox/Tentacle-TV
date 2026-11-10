#pragma once
// Le protocole du verre natif entre la page et la coquille — le reflet de
// `apps/desktop-electron/src/main/liquidGlass/protocol.ts`, dont il garde les noms, les
// bornes et les champs. Pur : ni CEF, ni AppKit.
//
// Le contrat vu de la page est déclaré par le front (`apps/web/src/desktop/types.ts`,
// `LiquidGlassBridge` et `NativeGlassRegion`) ; le shim (`web/shim/tentacle-bridge.js`)
// regroupe les changements d'une même tâche en UN message (`batcher.ts` d'Electron), et la
// coquille revalide tout (`validate.h`) : la page n'est jamais crue sur parole.

#include <array>
#include <optional>
#include <string>
#include <vector>

namespace tentacle::glass {

/// Canal page → natif : un lot par tâche JavaScript (`tentacle:liquid-glass` d'Electron).
inline constexpr const char* kBatchChannel = "liquidGlass.batch";
/// Canal page → natif, avec réponse : la luminance sous des rectangles.
inline constexpr const char* kSampleChannel = "liquidGlass.sample";
/// Un nouveau document : le verre de la page précédente part (`did-navigate` d'Electron).
inline constexpr const char* kPageStartedChannel = "liquidGlass.pageStarted";
/// Diagnostic des bancs (hors `window.tentacle`) : l'instantané relu dans AppKit.
inline constexpr const char* kSnapshotChannel = "liquidGlass.debug.snapshot";

/// Les quatre niveaux des jetons `--lg-*`. AppKit n'a que deux styles : voir `nativeStyle`.
enum class Level { Regular, Clear, Tinted, Prominent };
/// L'apparence d'un verre, quelle que soit celle de la fenêtre.
enum class Appearance { Dark, Light };

/// Une Bézier `x1, y1, x2, y2`, tous dans [0, 1] — celle que la page joue en CSS.
using Ease = std::array<double, 4>;

/// Le départ et l'arrivée d'un verre qui se matérialise (lot lg8) — les nombres de la page.
struct Materialize {
  double rise = 0;     // px CSS : le verre part d'autant plus BAS (négatif : plus haut)
  double scale = 1;    // échelle de départ, autour de l'origine
  double originX = 0.5, originY = 0.5;  // origine dans la forme, 0..1 (Y depuis le HAUT)
  double delay = 0;    // décalage de l'entrée, en ms (l'ordre des formes)
  double exit = 0;     // durée de la sortie, en ms
  Ease enterEase{}, exitEase{};
  bool operator==(const Materialize&) const = default;
};

/// Un ressort au paramétrage d'Apple — celui de `theme/glass/springs.ts`.
struct SpringSpec {
  double response = 0;         // période non amortie, en secondes
  double dampingFraction = 0;  // 1 = critique, < 1 = rebond
  bool operator==(const SpringSpec&) const = default;
};

/// Une région de verre, telle que la page la décrit (px CSS du viewport).
struct Region {
  std::string id;
  double x = 0, y = 0, width = 0, height = 0;
  double radius = 0;                // rayon des coins, px CSS
  Level level = Level::Regular;
  std::optional<std::string> tint;  // `#RRGGBB[AA]` ; absent : le matériau du système
  bool interactive = false;         // sans API publique : sans effet natif
  double z = 0;                     // ordre d'empilement, la plus grande au-dessus
  // En plus (facultatifs) — voir protocol.ts.
  std::optional<std::string> group;
  std::optional<double> spacing;
  std::optional<double> transition;  // ms : apparitions, disparitions et déplacements animés
  std::optional<SpringSpec> spring;
  std::optional<Appearance> appearance;
  std::optional<Materialize> materialize;
};

/// Ce qui traverse le canal : les changements d'une tâche.
struct Batch {
  std::optional<bool> enabled;  // le réglage de l'utilisateur, s'il a changé
  std::vector<Region> upserts;
  std::vector<std::string> removes;
};

/// Un rectangle à échantillonner, px CSS du viewport.
struct SampleRect {
  double x = 0, y = 0, width = 0, height = 0;
  /// `under: "window"` : la vidéo SEULE, page exclue (une forme posée dessus).
  bool underWindow = false;
};

inline constexpr int kMaxSampleRects = 32;  // au plus, par appel de `sample`
inline constexpr int kMaxRegions = 64;      // au-delà, la page a une fuite, pas un besoin
inline constexpr int kMaxIdLength = 64;     // identifiant de région ou de groupe (UTF-16)
inline constexpr double kMaxTransitionMs = 1000;

const char* levelName(Level level);
const char* appearanceName(Appearance appearance);

}  // namespace tentacle::glass
