// La sonde de surface du lecteur vidéo — DÉVELOPPEMENT, macOS (comme Electron :
// `ipc/videoProbe.ts`, `video/macosProbe.ts`, `video/macosCapture.ts`) : `video_surface_probe`
// (géométrie, n° de fenêtre, EDR, statistiques d'une capture, verdict) et `video_edr_probe`
// (le seul headroom EDR, sans capture). Lue par le panneau de dev du lecteur (`dev/surfaceProbe.ts`).
//
// Ici, les RÈGLES pures (lecture d'une capture BMP, verdict), testées seules ; la capture et
// l'écran sont dans `src/platform/macos/video_probe_mac.mm`.
//
// Une différence de nature avec Electron, dite dans le verdict : Electron capture la fenêtre
// de mpv SEULE ; sous CEF la vidéo est une couche de NOTRE fenêtre, sous la page — la capture
// est ce que l'utilisateur voit (page transparente en lecture, contrôles masqués compris).
#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "ports.h"

namespace bridge::probe {

struct ImageStats {
  int largeur = 0, hauteur = 0;
  double nonNoirs = 0;  // part de pixels non noirs, 0..1
  double moyenne = 0;   // luminance moyenne (Rec. 601), 0..255
  double stdDev = 0;    // écart-type des luminances : un aplat vaut 0
  int teintes = 0;      // teintes distinctes, cinq bits par canal
};

// Un BMP 24 ou 32 bits (ce que rend `screencapture -t bmp`) → statistiques, un pixel sur
// quatre dans chaque sens. Rend le motif d'une capture illisible.
std::optional<std::string> statsFromBmp(const std::vector<uint8_t>& bmp, ImageStats& out);

// « IMAGE VISIBLE — … », « RIEN A VOIR — … » ou « INDETERMINE — <motif> » (seuils d'Electron :
// 35 % non noirs, écart-type 4).
std::string verdict(const std::optional<ImageStats>& image, const std::optional<std::string>& error);

Json toJson(const ImageStats& s);

}  // namespace bridge::probe
