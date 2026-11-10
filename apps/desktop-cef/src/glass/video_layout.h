#pragma once
// Où tombe un rectangle de la page dans l'image que mpv a décodée — `videoLayout.ts`
// d'Electron, à l'identique. Pur, testé.
//
// La vidéo est posée sous la page (son cadre, en points de la vue, origine en haut à gauche) ;
// mpv y ajuste l'image à son rapport d'aspect, centrée (`keepaspect`, sans zoom ni `panscan`).
// ⚠️ Pas `osd-dimensions` : avec l'OSD coupé (`osd-level=0`), mpv le laisse à 0 × 0. Chaque
// point de la grille d'un rectangle tombe alors hors de la vidéo (transparent : rien à en
// dire), dans une bande noire (noir opaque : c'est ce qui s'y voit), ou dans l'image, à une
// fraction (0..1) de sa largeur et de sa hauteur — les mêmes points que `gridSamples`.

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "glass/luminance.h"

namespace tentacle::glass {

/// La vidéo dans la vue, et le cadre de l'image dans la vidéo (fractions).
struct VideoLayout {
  Box window;
  double x0 = 0, x1 = 1, y0 = 0, y1 = 1;
};

struct GridPoint {
  enum class Kind { Frame, Bar, Outside };
  Kind kind = Kind::Outside;
  double fx = 0, fy = 0;  // Frame seulement
};

/// Le rapport d'aspect AFFICHÉ d'après `video-params` : `dw` / `dh` (pixels non carrés
/// compris), retourné d'un quart de tour si la vidéo l'est. nullopt sans image. Accepte l'objet
/// de mpv (le lecteur) ou son texte JSON (le pont d'Electron, ses tests).
std::optional<double> displayAspect(const nlohmann::json& params);
std::optional<double> displayAspect(const std::optional<std::string>& raw);

/// L'image d'aspect `aspect` ajustée au centre de la vidéo ; nullopt si l'un des deux est vide.
std::optional<VideoLayout> videoLayout(const Box& window, double aspect);

/// Les points de la grille de `box` (points de la vue).
std::vector<GridPoint> gridPoints(const VideoLayout& layout, const Box& box, int grid = kSampleGrid);

/// Les échantillons BGRA de ces points dans une image `width` × `height`, lus un par un :
/// `pixel(x, y)` rend le mot de 32 bits du pixel (BGRA, petit-boutiste) — la grille seule,
/// jamais l'image entière.
Samples videoSamples(const std::vector<GridPoint>& points, int width, int height,
                     const std::function<uint32_t(int x, int y)>& pixel);

}  // namespace tentacle::glass
