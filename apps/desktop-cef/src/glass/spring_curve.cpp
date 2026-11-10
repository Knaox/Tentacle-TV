#include "glass/spring_curve.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <mutex>
#include <utility>

namespace tentacle::glass {
namespace {

constexpr int kSamples = 48;
constexpr double kPi = 3.14159265358979323846;

double clamp01(double v) { return std::min(1.0, std::max(0.0, v)); }

/// `Math.round` de JavaScript (moitié vers +∞).
double roundJs(double v) { return std::floor(v + 0.5); }

/// Bézier aux moindres carrés sur la réponse du ressort, par descente coordonnée — la même
/// recherche qu'Electron, pas pour pas.
Ease fit(const std::array<double, kSamples + 1>& target) {
  const auto error = [&](const Ease& p) {
    double sum = 0;
    for (int i = 0; i <= kSamples; ++i) {
      const double d = bezierAt(p, static_cast<double>(i) / kSamples) - target[i];
      sum += d * d;
    }
    return sum;
  };
  Ease best{0.25, 0.8, 0.3, 1};
  double bestError = error(best);
  for (double step = 0.2; step > 1e-4;) {
    bool improved = false;
    for (int k = 0; k < 4; ++k) {
      for (const int direction : {-1, 1}) {
        Ease candidate = best;
        candidate[k] = clamp01(candidate[k] + direction * step);
        const double candidateError = error(candidate);
        if (candidateError < bestError) {
          best = candidate;
          bestError = candidateError;
          improved = true;
        }
      }
    }
    if (!improved) step /= 2;
  }
  for (double& v : best) v = roundJs(v * 1000) / 1000;
  return best;
}

}  // namespace

double springPosition(const SpringSpec& spring, double t) {
  if (t <= 0) return 0;
  const double omega0 = (2 * kPi) / spring.response;
  const double zeta = spring.dampingFraction;
  if (zeta < 1) {
    const double omegaD = omega0 * std::sqrt(1 - zeta * zeta);
    const double envelope = std::exp(-zeta * omega0 * t);
    return 1 - envelope * (std::cos(omegaD * t) + ((zeta * omega0) / omegaD) * std::sin(omegaD * t));
  }
  if (zeta == 1) return 1 - std::exp(-omega0 * t) * (1 + omega0 * t);
  const double root = std::sqrt(zeta * zeta - 1);
  const double r1 = -omega0 * (zeta - root);
  const double r2 = -omega0 * (zeta + root);
  const double c2 = r1 / (r1 - r2);
  return 1 - ((1 - c2) * std::exp(r1 * t) + c2 * std::exp(r2 * t));
}

double springCutSeconds(const SpringSpec& spring, double epsilon) {
  for (long ms = static_cast<long>(std::ceil(spring.response * 6 * 1000)); ms >= 0; --ms) {
    if (std::abs(1 - springPosition(spring, ms / 1000.0)) > epsilon) return (ms + 1) / 1000.0;
  }
  return 0;
}

double bezierAt(const Ease& points, double u) {
  const auto [x1, y1, x2, y2] = points;
  const auto curve = [](double a, double b, double s) {
    return 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  };
  double lo = 0, hi = 1, s = u;
  for (int i = 0; i < 40; ++i) {
    const double x = curve(x1, x2, s);
    if (std::abs(x - u) < 1e-6) break;
    if (x < u) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return curve(y1, y2, s);
}

const NativeMotion& springMotion(const SpringSpec& spring) {
  // Le cache est lu sur le fil principal en pratique ; le verrou ne coûte rien et garde les
  // tests (ou un autre fil) honnêtes. Les références rendues restent valables (std::map).
  static std::mutex lock;
  static std::map<std::pair<double, double>, NativeMotion> fitted;
  std::lock_guard<std::mutex> guard(lock);
  const auto key = std::make_pair(spring.response, spring.dampingFraction);
  if (const auto known = fitted.find(key); known != fitted.end()) return known->second;
  const double seconds = springCutSeconds(spring);
  std::array<double, kSamples + 1> target{};
  // Le dernier point est forcé au but, comme le fait la page pour son `linear()`.
  for (int i = 0; i <= kSamples; ++i)
    target[i] = i == kSamples ? 1 : springPosition(spring, (static_cast<double>(i) / kSamples) * seconds);
  NativeMotion motion{roundJs(seconds * 1000), fit(target)};
  return fitted.emplace(key, motion).first->second;
}

std::optional<NativeMotion> motionOf(const std::optional<double>& transition,
                                     const std::optional<SpringSpec>& spring) {
  if (transition.value_or(0) <= 0) return std::nullopt;
  return springMotion(spring.value_or(springs::kMorph));
}

}  // namespace tentacle::glass
