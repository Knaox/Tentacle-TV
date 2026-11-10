#include "glass/luminance.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace tentacle::glass {
namespace {

/// En deçà, le pixel est transparent : la page n'y peint rien, il ne dit rien du dessous.
constexpr int kOpaqueAlpha = 128;

}  // namespace

double linearize(double c8) {
  const double c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : std::pow((c + 0.055) / 1.055, 2.4);
}

double relativeLuminance(double r, double g, double b) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

std::optional<double> median(std::vector<double> values) {
  if (values.empty()) return std::nullopt;
  std::sort(values.begin(), values.end());
  const size_t middle = values.size() / 2;
  return values.size() % 2 == 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

std::optional<Samples> gridSamples(const uint8_t* bgra, int imageWidth, int imageHeight, const Box& box, int grid,
                                   size_t stride) {
  if (!(box.width > 0 && box.height > 0)) return std::nullopt;
  const size_t rowBytes = stride != 0 ? stride : static_cast<size_t>(imageWidth) * 4;
  Samples samples(static_cast<size_t>(grid) * grid * 4, 0);
  for (int j = 0; j < grid; ++j) {
    const double y = std::floor(box.y + ((j + 0.5) * box.height) / grid);
    if (y < 0 || y >= imageHeight) continue;
    for (int i = 0; i < grid; ++i) {
      const double x = std::floor(box.x + ((i + 0.5) * box.width) / grid);
      if (x < 0 || x >= imageWidth) continue;
      const uint8_t* p = bgra + static_cast<size_t>(y) * rowBytes + static_cast<size_t>(x) * 4;
      std::memcpy(&samples[(static_cast<size_t>(j) * grid + i) * 4], p, 4);
    }
  }
  return samples;
}

std::optional<double> medianOfSamples(const Samples& samples) {
  std::vector<double> values;
  for (size_t p = 0; p + 3 < samples.size(); p += 4) {
    if (samples[p + 3] < kOpaqueAlpha) continue;
    values.push_back(relativeLuminance(samples[p + 2], samples[p + 1], samples[p]));
  }
  return median(std::move(values));
}

std::optional<double> medianLuminance(const uint8_t* bgra, int imageWidth, int imageHeight, const Box& box,
                                      int grid) {
  const auto samples = gridSamples(bgra, imageWidth, imageHeight, box, grid);
  return samples ? medianOfSamples(*samples) : std::nullopt;
}

bool seesThrough(const Samples& samples) {
  for (size_t p = 3; p < samples.size(); p += 4)
    if (samples[p] < 255) return true;
  return false;
}

Samples compositeOver(const Samples& page, const Samples& video) {
  Samples out(page.size(), 0);
  for (size_t p = 0; p + 3 < page.size(); p += 4) {
    const int alpha = page[p + 3];
    if (p + 3 >= video.size() || video[p + 3] < kOpaqueAlpha) {
      std::memcpy(&out[p], &page[p], 4);
      continue;
    }
    const double rest = 1 - alpha / 255.0;
    for (size_t c = 0; c < 3; ++c) {
      // `Math.min(255, Math.round(…))` de JavaScript : la moitié monte.
      out[p + c] = static_cast<uint8_t>(std::min(255.0, std::floor(page[p + c] + video[p + c] * rest + 0.5)));
    }
    out[p + 3] = 255;
  }
  return out;
}

Box unionBox(const std::vector<Box>& boxes) {
  double x0 = INFINITY, y0 = INFINITY, x1 = -INFINITY, y1 = -INFINITY;
  for (const auto& b : boxes) {
    x0 = std::min(x0, b.x);
    y0 = std::min(y0, b.y);
    x1 = std::max(x1, b.x + b.width);
    y1 = std::max(y1, b.y + b.height);
  }
  return {x0, y0, x1 - x0, y1 - y0};
}

double reductionFor(const std::vector<Box>& boxes, int grid) {
  double smallest = INFINITY;
  for (const auto& b : boxes) smallest = std::min(smallest, std::min(b.width, b.height));
  return smallest <= 0 ? 1 : std::min(1.0, std::max(grid / smallest, 0.125));
}

}  // namespace tentacle::glass
