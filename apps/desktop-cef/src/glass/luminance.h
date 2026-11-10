#pragma once
// La luminance de ce qui est SOUS une surface de verre — pour que ses glyphes s'adaptent au
// contenu (sombres sur un dessous clair, et inversement), comme le Liquid Glass d'Apple.
// `luminance.ts` d'Electron, à l'identique.
//
// Pur : les images arrivent en BGRA prémultiplié (la page de CEF ; la grille de la vidéo,
// opaque, de `video_layout.h`) et ne repartent qu'en NOMBRES — jamais un pixel vers la page.

#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

namespace tentacle::glass {

/// Un rectangle, en pixels de l'image ou en points selon l'appelant.
struct Box {
  double x = 0, y = 0, width = 0, height = 0;
  bool operator==(const Box&) const = default;
};

using Samples = std::vector<uint8_t>;  // grille × grille × 4 octets BGRA

/// Côté de la grille d'échantillons par rectangle : 16 × 16 suffisent à une médiane.
inline constexpr int kSampleGrid = 16;

/// Une composante sRGB 8 bits, linéarisée (0..1).
double linearize(double c8);
/// Luminance relative (0..1) d'un pixel sRGB 8 bits — la définition du WCAG.
double relativeLuminance(double r, double g, double b);
/// La médiane, nullopt sans valeur (les glyphes de la surface ne la tirent pas).
std::optional<double> median(std::vector<double> values);

/// Les échantillons d'une grille `grid` × `grid` sur `box` (pixels de l'image) : un point au
/// CENTRE de chaque case, ligne par ligne depuis le haut. Un point hors de l'image est
/// transparent : la grille garde sa place sur la boîte ENTIÈRE, si bien que la page et la
/// vidéo se composent case à case. nullopt si la boîte est vide. `stride` : octets par ligne
/// (0 : `imageWidth × 4`, l'image serrée d'Electron).
std::optional<Samples> gridSamples(const uint8_t* bgra, int imageWidth, int imageHeight, const Box& box,
                                   int grid = kSampleGrid, size_t stride = 0);
/// Médiane de la luminance des échantillons, les transparents ignorés ; nullopt sans opaque.
std::optional<double> medianOfSamples(const Samples& samples);
/// Médiane de la luminance sur une grille dans `box` ; nullopt si rien d'opaque.
std::optional<double> medianLuminance(const uint8_t* bgra, int imageWidth, int imageHeight, const Box& box,
                                      int grid = kSampleGrid);
/// La page laisse-t-elle voir le dessous quelque part (un échantillon pas pleinement opaque) ?
bool seesThrough(const Samples& samples);
/// La page posée sur la vidéo, échantillon par échantillon (prémultiplié, « source sur
/// destination » dans l'espace sRGB encodé où Chromium compose) ; une vidéo transparente (hors
/// de la vidéo : le bandeau, une marge) ne compose rien.
Samples compositeOver(const Samples& page, const Samples& video);
/// Le plus petit rectangle qui contient tous les autres.
Box unionBox(const std::vector<Box>& boxes);
/// Le facteur de réduction d'une capture (Electron : `capturePage` réduite). Gardé pour le
/// contrat ; sous CEF on lit les points de la grille dans l'image de la page, sans la copier.
double reductionFor(const std::vector<Box>& boxes, int grid = kSampleGrid);

}  // namespace tentacle::glass
