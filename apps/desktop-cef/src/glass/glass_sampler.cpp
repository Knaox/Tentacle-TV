#include "glass/glass_sampler.h"

#include <SDL3/SDL.h>

#include <algorithm>
#include <cmath>

namespace tentacle::glass {
namespace {

/// Rogné à ce que la vue montre (bords entiers, comme Electron) ; nullopt s'il ne reste rien.
std::optional<Box> clampBox(const Box& box, const Box& view) {
  const double x0 = std::max(view.x, std::floor(box.x));
  const double y0 = std::max(view.y, std::floor(box.y));
  const double x1 = std::min(view.x + view.width, std::ceil(box.x + box.width));
  const double y1 = std::min(view.y + view.height, std::ceil(box.y + box.height));
  if (!(x1 > x0 && y1 > y0)) return std::nullopt;
  return Box{x0, y0, x1 - x0, y1 - y0};
}

}  // namespace

void GlassSampler::sample(std::vector<SampleRect> rects, std::function<void(SampleResult)> done) {
  queue_.push_back(Job{std::move(rects), std::move(done)});
  if (!busy_) next();
}

void GlassSampler::next() {
  if (queue_.empty()) {
    busy_ = false;
    return;
  }
  busy_ = true;
  Job job = std::move(queue_.front());
  queue_.pop_front();
  measure(std::move(job));
}

void GlassSampler::measure(Job job) {
  // La page compte en points de la vue (zoom de CEF : 1, aucune commande ne le change ici).
  constexpr double zoom = 1;
  int w = 0, h = 0;
  SDL_GetWindowSize(window_, &w, &h);  // points sur macOS (le seul système qui a le verre)
  const Box view{0, 0, static_cast<double>(w), static_cast<double>(h)};
  auto boxes = std::make_shared<std::vector<std::optional<Box>>>();
  std::vector<std::optional<Box>> pageBoxes;
  auto behind = std::make_shared<std::vector<bool>>();
  for (const auto& r : job.rects) {
    boxes->push_back(clampBox({r.x * zoom, r.y * zoom, r.width * zoom, r.height * zoom}, view));
    behind->push_back(r.underWindow);
    pageBoxes.push_back(r.underWindow ? std::nullopt : boxes->back());
  }
  auto done = std::make_shared<std::function<void(SampleResult)>>(std::move(job.done));
  std::weak_ptr<int> alive = alive_;
  const auto finish = [this, done, alive](SampleResult result) {
    (*done)(std::move(result));
    if (alive.lock()) next();
  };
  platform::readPageGrids(compositor_, view.width, std::move(pageBoxes),
                          [this, boxes, behind, finish, alive](platform::Grids pages) {
    if (!alive.lock()) return finish(SampleResult(boxes->size()));
    bool wantsVideo = false;
    for (size_t k = 0; k < boxes->size(); ++k) {
      if ((*boxes)[k] && (*behind)[k]) wantsVideo = true;
      if (pages[k] && seesThrough(*pages[k])) wantsVideo = true;
    }
    auto compose = [boxes, behind, pages, finish](std::optional<platform::Grids> videos) {
      SampleResult result;
      for (size_t k = 0; k < boxes->size(); ++k) {
        const std::optional<Samples> video = videos && k < videos->size() ? (*videos)[k] : std::nullopt;
        if ((*behind)[k]) {
          result.push_back(video ? medianOfSamples(*video) : std::nullopt);
        } else if (!pages[k]) {
          result.push_back(std::nullopt);
        } else {
          result.push_back(medianOfSamples(video ? compositeOver(*pages[k], *video) : *pages[k]));
        }
      }
      finish(std::move(result));
    };
    if (!wantsVideo) return compose(std::nullopt);
    video_.grab(*boxes, std::move(compose));
  });
}

}  // namespace tentacle::glass
