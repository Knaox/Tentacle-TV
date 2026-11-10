// Le gestionnaire de régions : lots, réglage, départs, page partie, fenêtre détruite.
// Les poses (upsert, mount, restack) : `regions_mount.cpp`.
#include "glass/regions.h"

#include <algorithm>
#include <cmath>
#include <limits>

#include "glass/snapshot.h"

namespace tentacle::glass {
namespace {

/// Le conteneur d'une région : celui de son groupe, ou le sien seul.
std::string keyOf(const Region& region) {
  return region.group ? "groupe:" + *region.group : "seule:" + region.id;
}

}  // namespace

GlassRegions::GlassRegions(GlassBackend& backend, Timers& timers, std::function<void(const std::string&)> log)
    : backend_(backend), timers_(timers), log_(std::move(log)), stage_(backend, timers), entries_(timers) {}

void GlassRegions::apply(const Batch& batch, double zoom) {
  if (batch.enabled) setEnabled(*batch.enabled);
  std::set<std::string> arriving;
  for (const auto& region : batch.upserts) arriving.insert(keyOf(region));
  depart(batch.removes, arriving);
  if (!batch.upserts.empty()) {
    const double height = enabled_ ? backend_.contentHeight() : 0;
    Reveal reveal;
    for (const auto& region : batch.upserts) upsert(region, zoom, height, reveal);
    for (const auto& [key, ms] : reveal) stage_.reveal(key, ms);
  }
  prune();
}

void GlassRegions::setEnabled(bool next) {
  if (next == enabled_) return;
  enabled_ = next;
  if (!next) return demolish();
  const double height = backend_.contentHeight();
  std::vector<EntryPtr> ordered = regions_;
  std::stable_sort(ordered.begin(), ordered.end(), [](const EntryPtr& a, const EntryPtr& b) {
    return a->region.z < b->region.z || (a->region.z == b->region.z && a->seq < b->seq);
  });
  for (const auto& entry : ordered) mount(entry, height, nullptr);
}

void GlassRegions::clear() {
  demolish();
  regions_.clear();
}

void GlassRegions::forget() {
  entries_.cancelAll();
  for (const auto& [view, leaving] : shrinking_) {
    timers_.clear(leaving.timer);
    backend_.release(view);
  }
  shrinking_.clear();
  for (const auto& entry : regions_) {
    if (entry->view != nullptr) backend_.release(entry->view);
    entry->view = nullptr;
  }
  regions_.clear();
  stage_.forget();
}

nlohmann::json GlassRegions::snapshot() {
  auto regions = nlohmann::json::array();
  for (const auto& entry : regions_) {
    std::optional<GlassInspection> native;
    if (entry->view != nullptr) native = backend_.inspect(entry->view);
    regions.push_back(describeRegion(entry->region, native));
  }
  auto leaving = nlohmann::json::array();
  for (const ViewHandle view : stage_.retiringViews()) leaving.push_back(liveJson(backend_.inspect(view).live));
  return {{"enabled", enabled_},       {"surfaceVisible", stage_.isSurfaceVisible()},
          {"root", stage_.hasRoot()},  {"groups", stage_.groupCount()},
          {"nativeViews", stage_.nativeViews()}, {"regions", regions},
          {"leaving", leaving}};
}

void GlassRegions::depart(const std::vector<std::string>& ids, const std::set<std::string>& arriving) {
  std::vector<EntryPtr> removed;
  for (const auto& id : ids) {
    const EntryPtr entry = find(id);
    if (!entry) continue;
    erase(id);
    removed.push_back(entry);
  }
  struct Bag {
    std::vector<ViewHandle> views;
    double ms = 0;
    std::optional<Ease> ease;
  };
  std::vector<std::pair<std::string, Bag>> retiring;  // ordre d'arrivée, une entrée par clé
  const auto bagOf = [&](const std::string& key) -> Bag& {
    for (auto& [k, bag] : retiring)
      if (k == key) return bag;
    retiring.emplace_back(key, Bag{});
    return retiring.back().second;
  };
  for (const auto& entry : removed) {
    entries_.cancel(entry->region.id);
    const ViewHandle view = entry->view;
    if (view == nullptr) continue;
    entry->view = nullptr;
    const auto& m = entry->region.materialize;
    const double ms = m ? m->exit : entry->region.transition.value_or(0);
    if (m && ms > 0 && !entry->region.group) {
      // Seule dans son conteneur : elle redescend vers son départ pendant qu'il s'éteint.
      const Rect frame = toAppKitFrame(entry->rect, backend_.contentHeight());
      backend_.setFrame(view, materializeFrom(frame, *m, entry->zoom), exitMotion(*m));
      bagOf(entry->groupKey) = Bag{{view}, ms, m->exitEase};
    } else if (ms <= 0) {
      backend_.dispose(view);
    } else if (arriving.count(entry->groupKey) || hasLiveView(entry->groupKey)) {
      shrink(*entry, view);
    } else {
      Bag& bag = bagOf(entry->groupKey);
      bag.views.push_back(view);
      bag.ms = std::max(bag.ms, ms);
    }
  }
  for (auto& [key, bag] : retiring) stage_.retire(key, bag.ms, std::move(bag.views), bag.ease);
}

void GlassRegions::shrink(const Entry& entry, ViewHandle view) {
  const auto motion = motionOf(entry.region.transition, entry.region.spring);
  backend_.setFrame(view, centerOf(backend_.inspect(view).frame), motion);
  const TimerId timer = timers_.set(
      [this, view] {
        shrinking_.erase(view);
        backend_.dispose(view);
        prune();
      },
      (motion ? motion->durationMs : 0) + kLeaveMarginMs);
  shrinking_[view] = Shrinking{timer, entry.groupKey};
}

bool GlassRegions::hasLiveView(const std::string& key) const {
  for (const auto& entry : regions_)
    if (entry->groupKey == key && entry->view != nullptr) return true;
  return false;
}

double GlassRegions::topZ(const std::string& key) const {
  double top = -std::numeric_limits<double>::infinity();
  for (const auto& entry : regions_)
    if (entry->groupKey == key && entry->view != nullptr) top = std::max(top, entry->region.z);
  return top;
}

double GlassRegions::spacingOf(const std::string& key) const {
  double spacing = 0;
  for (const auto& entry : regions_)
    if (entry->groupKey == key && entry->region.group) spacing = std::max(spacing, entry->region.spacing.value_or(0));
  return spacing;
}

void GlassRegions::prune() {
  stage_.prune([this](const std::string& key) {
    if (hasLiveView(key)) return true;
    for (const auto& [view, s] : shrinking_)
      if (s.groupKey == key) return true;
    return false;
  });
}

void GlassRegions::demolish() {
  entries_.cancelAll();
  for (const auto& [view, leaving] : shrinking_) {
    timers_.clear(leaving.timer);
    backend_.dispose(view);
  }
  shrinking_.clear();
  stage_.settleRetiring();
  for (const auto& entry : regions_) {
    if (entry->view != nullptr) backend_.dispose(entry->view);
    entry->view = nullptr;
  }
  prune();
}

void GlassRegions::overflow() {
  if (overflowTold_) return;
  overflowTold_ = true;
  log_("plus de " + std::to_string(kMaxRegions) +
       " regions de verre : les suivantes sont ignorees (fuite de la page ?)");
}

GlassRegions::EntryPtr GlassRegions::find(const std::string& id) const {
  for (const auto& entry : regions_)
    if (entry->region.id == id) return entry;
  return nullptr;
}

void GlassRegions::erase(const std::string& id) {
  regions_.erase(std::remove_if(regions_.begin(), regions_.end(),
                                [&](const EntryPtr& e) { return e->region.id == id; }),
                 regions_.end());
}

}  // namespace tentacle::glass
