#include "glass/video_layout.h"

#include <algorithm>
#include <cmath>

namespace tentacle::glass {

std::optional<double> displayAspect(const nlohmann::json& params) {
  if (!params.is_object()) return std::nullopt;
  const auto width = params.find("dw");
  const auto height = params.find("dh");
  if (width == params.end() || height == params.end() || !width->is_number() || !height->is_number())
    return std::nullopt;
  const double w = width->get<double>(), h = height->get<double>();
  if (!(w > 0 && h > 0)) return std::nullopt;
  const auto rotate = params.find("rotate");
  const double r = rotate != params.end() && rotate->is_number() ? rotate->get<double>() : 0;
  return std::fmod(r, 180) == 90 ? h / w : w / h;
}

std::optional<double> displayAspect(const std::optional<std::string>& raw) {
  if (!raw) return std::nullopt;
  const auto parsed = nlohmann::json::parse(*raw, nullptr, false);
  if (parsed.is_discarded()) return std::nullopt;
  return displayAspect(parsed);
}

std::optional<VideoLayout> videoLayout(const Box& window, double aspect) {
  if (!(aspect > 0 && window.width > 0 && window.height > 0)) return std::nullopt;
  const double windowAspect = window.width / window.height;
  if (aspect >= windowAspect) {
    const double height = windowAspect / aspect;
    return VideoLayout{window, 0, 1, (1 - height) / 2, (1 + height) / 2};
  }
  const double width = aspect / windowAspect;
  return VideoLayout{window, (1 - width) / 2, (1 + width) / 2, 0, 1};
}

std::vector<GridPoint> gridPoints(const VideoLayout& layout, const Box& box, int grid) {
  std::vector<GridPoint> points;
  points.reserve(static_cast<size_t>(grid) * grid);
  for (int j = 0; j < grid; ++j) {
    const double wy = (box.y + ((j + 0.5) * box.height) / grid - layout.window.y) / layout.window.height;
    for (int i = 0; i < grid; ++i) {
      const double wx = (box.x + ((i + 0.5) * box.width) / grid - layout.window.x) / layout.window.width;
      if (wx < 0 || wx >= 1 || wy < 0 || wy >= 1) {
        points.push_back({GridPoint::Kind::Outside});
      } else if (wx < layout.x0 || wx >= layout.x1 || wy < layout.y0 || wy >= layout.y1) {
        points.push_back({GridPoint::Kind::Bar});
      } else {
        points.push_back({GridPoint::Kind::Frame, (wx - layout.x0) / (layout.x1 - layout.x0),
                          (wy - layout.y0) / (layout.y1 - layout.y0)});
      }
    }
  }
  return points;
}

Samples videoSamples(const std::vector<GridPoint>& points, int width, int height,
                     const std::function<uint32_t(int x, int y)>& pixel) {
  Samples samples(points.size() * 4, 0);
  for (size_t k = 0; k < points.size(); ++k) {
    const GridPoint& point = points[k];
    if (point.kind == GridPoint::Kind::Outside) continue;
    samples[k * 4 + 3] = 255;
    if (point.kind == GridPoint::Kind::Bar) continue;
    const int x = std::min(width - 1, static_cast<int>(std::floor(point.fx * width)));
    const int y = std::min(height - 1, static_cast<int>(std::floor(point.fy * height)));
    const uint32_t word = pixel(x, y);
    samples[k * 4] = word & 255;
    samples[k * 4 + 1] = (word >> 8) & 255;
    samples[k * 4 + 2] = (word >> 16) & 255;
  }
  return samples;
}

}  // namespace tentacle::glass
