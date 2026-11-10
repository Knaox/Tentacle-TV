#include "video_probe.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <set>

namespace bridge::probe {
namespace {

constexpr int kStep = 4;
constexpr double kBlackThreshold = 8;
constexpr double kImageThreshold = 0.35;
constexpr double kStdDevThreshold = 4;

uint32_t u32(const std::vector<uint8_t>& b, size_t at) {
  return uint32_t(b[at]) | uint32_t(b[at + 1]) << 8 | uint32_t(b[at + 2]) << 16 | uint32_t(b[at + 3]) << 24;
}
uint16_t u16(const std::vector<uint8_t>& b, size_t at) { return uint16_t(b[at] | b[at + 1] << 8); }

}  // namespace

std::optional<std::string> statsFromBmp(const std::vector<uint8_t>& b, ImageStats& out) {
  if (b.size() < 54 || u16(b, 0) != 0x4d42) return "capture illisible (pas un BMP)";
  const uint32_t offset = u32(b, 10);
  const int32_t width = static_cast<int32_t>(u32(b, 18));
  const int32_t rawHeight = static_cast<int32_t>(u32(b, 22));
  const int bits = u16(b, 28);
  if (bits != 24 && bits != 32) return "capture en " + std::to_string(bits) + " bits, non gérée";
  if (width <= 0 || rawHeight == 0) return "capture vide";
  const int bpp = bits / 8;
  const int height = std::abs(rawHeight);
  // Les lignes sont alignées sur quatre octets, quelle que soit la largeur.
  const size_t step = ((size_t(width) * bpp + 3) / 4) * 4;
  if (offset + step * size_t(height) > b.size()) return "capture tronquée";
  std::set<int> hues;
  double total = 0, nonBlack = 0, sum = 0, sumSquares = 0;
  for (int y = 0; y < height; y += kStep) {
    const uint8_t* line = b.data() + offset + size_t(y) * step;
    for (int x = 0; x < width; x += kStep) {
      const uint8_t* p = line + size_t(x) * bpp;
      const int blue = p[0], green = p[1], red = p[2];
      // Luminance perçue (Rec. 601) : un aplat bleu ne passe pas pour de l'image.
      const double luminance = (red * 299 + green * 587 + blue * 114) / 1000.0;
      total += 1;
      if (luminance > kBlackThreshold) nonBlack += 1;
      sum += luminance;
      sumSquares += luminance * luminance;
      hues.insert(((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3));
    }
  }
  const double mean = total == 0 ? 0 : sum / total;
  out.largeur = width;
  out.hauteur = height;
  out.nonNoirs = total == 0 ? 0 : nonBlack / total;
  out.moyenne = mean;
  out.stdDev = total == 0 ? 0 : std::sqrt(std::max(0.0, sumSquares / total - mean * mean));
  out.teintes = static_cast<int>(hues.size());
  return std::nullopt;
}

std::string verdict(const std::optional<ImageStats>& image, const std::optional<std::string>& error) {
  if (error) return "INDETERMINE — " + *error;
  if (!image) return "INDETERMINE — aucune fenetre video";
  char detail[160];
  std::snprintf(detail, sizeof detail, "%.1f %% non noirs, ecart-type %.1f, %d teintes", image->nonNoirs * 100, image->stdDev,
                image->teintes);
  const bool seen = image->nonNoirs >= kImageThreshold && image->stdDev >= kStdDevThreshold;
  return std::string(seen ? "IMAGE VISIBLE" : "RIEN A VOIR") + " — " + detail;
}

Json toJson(const ImageStats& s) {
  return {{"largeur", s.largeur}, {"hauteur", s.hauteur}, {"nonNoirs", s.nonNoirs},
          {"moyenne", s.moyenne}, {"stdDev", s.stdDev},   {"teintes", s.teintes}};
}

}  // namespace bridge::probe
