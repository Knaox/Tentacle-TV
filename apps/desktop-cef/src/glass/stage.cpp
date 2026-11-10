#include "glass/stage.h"

#include <algorithm>

namespace tentacle::glass {

ViewHandle GlassStage::content(const std::string& key, double spacing, double alpha) {
  if (const auto known = groups_.find(key); known != groups_.end()) return known->second.handle.content;
  const ViewHandle root = ensureRoot();
  if (root == nullptr) return nullptr;
  const GroupHandle handle = backend_.createGroup(root, spacing, alpha);
  groups_[key] = GroupEntry{handle, ++seq_, spacing};
  order_.push_back(key);
  return handle.content;
}

void GlassStage::reveal(const std::string& key, double durationMs, const std::optional<Ease>& ease) {
  const auto group = groups_.find(key);
  if (group != groups_.end()) backend_.setAlpha(group->second.handle.container, 1, durationMs, ease);
}

void GlassStage::retire(const std::string& key, double durationMs, std::vector<ViewHandle> views,
                        const std::optional<Ease>& ease) {
  const auto group = groups_.find(key);
  if (group == groups_.end()) return;
  const GroupHandle handle = group->second.handle;
  groups_.erase(group);
  order_.erase(std::remove(order_.begin(), order_.end(), key), order_.end());
  backend_.setAlpha(handle.container, 0, durationMs, ease);
  retiring_.push_back(Retiring{handle, std::move(views), 0});
  auto entry = std::prev(retiring_.end());
  entry->timer = timers_.set(
      [this, entry] {
        const Retiring done = *entry;
        retiring_.erase(entry);
        finish(done);
        prune([](const std::string&) { return true; });
      },
      durationMs + kLeaveMarginMs);
}

void GlassStage::restack(const std::string& key, const std::function<double(const std::string&)>& topZ) {
  const auto group = groups_.find(key);
  if (group == groups_.end() || root_ == nullptr || groups_.size() < 2) return;
  std::vector<Stackable> items;
  for (const auto& k : order_) items.push_back({k, topZ(k), groups_.at(k).seq});
  const auto anchorKey = stackAnchor(items, key);
  const ViewHandle anchor = anchorKey ? groups_.at(*anchorKey).handle.container : nullptr;
  backend_.placeBelow(root_, group->second.handle.container, anchor);
}

void GlassStage::setSpacing(const std::string& key, double spacing) {
  const auto group = groups_.find(key);
  if (group == groups_.end() || group->second.spacing == spacing) return;
  group->second.spacing = spacing;
  backend_.setSpacing(group->second.handle, spacing);
}

void GlassStage::setSurfaceVisible(bool visible) {
  surfaceVisible_ = visible;
  if (root_ != nullptr) backend_.setHidden(root_, !visible);
}

void GlassStage::prune(const std::function<bool(const std::string&)>& used) {
  const std::vector<std::string> keys = order_;  // copie : on retire en chemin
  for (const std::string& key : keys) {
    if (used(key)) continue;
    backend_.dispose(groups_.at(key).handle.container);
    groups_.erase(key);
    order_.erase(std::remove(order_.begin(), order_.end(), key), order_.end());
  }
  if (groups_.empty() && retiring_.empty() && root_ != nullptr) {
    backend_.dispose(root_);
    root_ = nullptr;
  }
}

void GlassStage::settleRetiring() {
  for (const auto& entry : retiring_) {
    timers_.clear(entry.timer);
    finish(entry);
  }
  retiring_.clear();
}

void GlassStage::forget() {
  for (const auto& entry : retiring_) {
    timers_.clear(entry.timer);
    for (const ViewHandle view : entry.views) backend_.release(view);
    backend_.release(entry.handle.container);
  }
  retiring_.clear();
  for (const auto& key : order_) backend_.release(groups_.at(key).handle.container);
  groups_.clear();
  order_.clear();
  if (root_ != nullptr) backend_.release(root_);
  root_ = nullptr;
}

std::vector<ViewHandle> GlassStage::retiringViews() const {
  std::vector<ViewHandle> views;
  for (const auto& entry : retiring_) views.insert(views.end(), entry.views.begin(), entry.views.end());
  return views;
}

int GlassStage::nativeViews() { return root_ == nullptr ? 0 : backend_.countGlass(root_); }

void GlassStage::finish(const Retiring& entry) {
  for (const ViewHandle view : entry.views) backend_.dispose(view);
  backend_.dispose(entry.handle.container);
}

ViewHandle GlassStage::ensureRoot() {
  if (root_ != nullptr) return root_;
  root_ = backend_.createRoot();
  if (root_ != nullptr && !surfaceVisible_) backend_.setHidden(root_, true);
  return root_;
}

}  // namespace tentacle::glass
