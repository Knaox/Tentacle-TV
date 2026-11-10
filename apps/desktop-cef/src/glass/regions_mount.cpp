// Le gestionnaire de régions : les poses — une région nouvelle ou changée, le montage d'une
// vue (fondus, naissance au centre, matérialisation) et l'empilement. Suite de `regions.cpp`.
#include <algorithm>
#include <cmath>

#include "glass/regions.h"

namespace tentacle::glass {
namespace {

std::string keyOf(const Region& region) {
  return region.group ? "groupe:" + *region.group : "seule:" + region.id;
}

double* revealOf(std::vector<std::pair<std::string, double>>& reveal, const std::string& key) {
  for (auto& [k, ms] : reveal)
    if (k == key) return &ms;
  return nullptr;
}

}  // namespace

void GlassRegions::upsert(const Region& region, double zoom, double height, Reveal& reveal) {
  const Rect rect = toPoints(region, zoom);
  const double radius = toPointRadius(region, zoom);
  const std::string groupKey = keyOf(region);
  const EntryPtr entry = find(region.id);
  if (!entry) {
    if (static_cast<int>(regions_.size()) >= kMaxRegions) return overflow();
    auto fresh = std::make_shared<Entry>(Entry{region, rect, radius, groupKey, zoom, ++seq_, nullptr});
    regions_.push_back(fresh);
    if (enabled_) mount(fresh, height, &reveal);
    return;
  }
  const Region previous = entry->region;
  const Rect previousRect = entry->rect;
  const double previousRadius = entry->radius;
  // Comme `Object.assign` d'Electron : la clé de groupe ne change qu'au remontage ci-dessous.
  entry->region = region;
  entry->rect = rect;
  entry->radius = radius;
  entry->zoom = zoom;
  if (!enabled_) return;
  if (entry->groupKey != groupKey || entry->view == nullptr) {
    // Changer de groupe, c'est changer de conteneur : on repose la vue.
    if (entry->view != nullptr) backend_.dispose(entry->view);
    entry->view = nullptr;
    entry->groupKey = groupKey;
    return mount(entry, height, &reveal);
  }
  const ViewHandle view = entry->view;
  if (!sameRect(previousRect, rect))
    backend_.setFrame(view, toAppKitFrame(rect, height), motionOf(region.transition, region.spring));
  if (std::abs(previousRadius - radius) >= 0.01) backend_.setRadius(view, radius);
  const int style = nativeStyle(region.level);
  if (nativeStyle(previous.level) != style) backend_.setStyle(view, style);
  if (previous.tint != region.tint) backend_.setTint(view, parseTint(region.tint));
  if (previous.appearance != region.appearance) backend_.setAppearance(view, region.appearance);
  if (previous.z != region.z) restack(*entry);
  stage_.setSpacing(groupKey, spacingOf(groupKey));
}

void GlassRegions::mount(const EntryPtr& entry, double height, Reveal* reveal) {
  const double ms = reveal == nullptr ? 0 : entry->region.transition.value_or(0);
  const bool opening = !stage_.has(entry->groupKey) || (reveal != nullptr && revealOf(*reveal, entry->groupKey));
  const ViewHandle content = stage_.content(entry->groupKey, spacingOf(entry->groupKey), opening && ms > 0 ? 0 : 1);
  if (content == nullptr) return;
  const Rect frame = toAppKitFrame(entry->rect, height);
  const bool grow = !opening && ms > 0;
  const auto m = entry->region.materialize;
  const bool materialize = m && opening && ms > 0 && reveal != nullptr && !entry->region.group;
  entry->view = backend_.createGlass(GlassProps{
      grow ? centerOf(frame) : materialize ? materializeFrom(frame, *m, entry->zoom) : frame,
      entry->radius,
      nativeStyle(entry->region.level),
      parseTint(entry->region.tint),
      entry->region.appearance,
  });
  restack(*entry);
  if (grow) backend_.setFrame(entry->view, frame, motionOf(entry->region.transition, entry->region.spring));
  if (materialize) {
    const ViewHandle view = entry->view;  // né transparent et décalé : après son décalage, il monte et s'allume
    const Materialize mat = *m;
    entries_.schedule(entry->region.id, mat.delay, [this, entry, view, mat, ms] {
      if (entry->view != view) return;  // partie entre-temps : rien à animer
      backend_.setFrame(view, toAppKitFrame(entry->rect, backend_.contentHeight()), enterMotion(mat, ms));
      stage_.reveal(entry->groupKey, ms, mat.enterEase);
    });
  } else if (opening && ms > 0 && reveal != nullptr) {
    if (double* known = revealOf(*reveal, entry->groupKey)) *known = std::max(*known, ms);
    else reveal->emplace_back(entry->groupKey, ms);
  }
  stage_.setSpacing(entry->groupKey, spacingOf(entry->groupKey));
}

void GlassRegions::restack(const Entry& entry) {
  const ViewHandle content = stage_.content(entry.groupKey, spacingOf(entry.groupKey));
  if (content == nullptr || entry.view == nullptr) return;
  std::vector<Stackable> siblings;
  for (const auto& e : regions_)
    if (e->groupKey == entry.groupKey && e->view != nullptr) siblings.push_back({e->region.id, e->region.z, e->seq});
  const auto anchorKey = stackAnchor(siblings, entry.region.id);
  const EntryPtr anchorEntry = anchorKey ? find(*anchorKey) : nullptr;
  backend_.placeBelow(content, entry.view, anchorEntry ? anchorEntry->view : nullptr);
  stage_.restack(entry.groupKey, [this](const std::string& key) { return topZ(key); });
}

}  // namespace tentacle::glass
