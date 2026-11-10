#include "music/audio_queue.h"

#include <algorithm>

namespace tentacle::music {
namespace {

QueueOp load(QueueOp::Mode mode, EntryPtr entry) {
  QueueOp op;
  op.op = QueueOp::Kind::Load;
  op.mode = mode;
  op.entry = std::move(entry);
  return op;
}

QueueOp simple(QueueOp::Kind kind, int index = 0, double seconds = 0) {
  QueueOp op;
  op.op = kind;
  op.index = index;
  op.seconds = seconds;
  return op;
}

QueueNotice swapped(const EntryPtr& e) {
  QueueNotice n;
  n.type = QueueNotice::Kind::Swapped;
  n.trackKey = e->track.trackKey;
  n.origin = e->source.origin;
  return n;
}

}  // namespace

EntryPtr AudioQueue::pendingSwap() const {
  return entries_.size() > 1 && entries_[1]->kind == EntryKind::Swap ? entries_[1] : nullptr;
}

int AudioQueue::appendedIndex(const std::string* trackKey) const {
  for (size_t i = 1; i < entries_.size(); i++)
    if (entries_[i]->kind != EntryKind::Swap && (!trackKey || entries_[i]->track.trackKey == *trackKey))
      return static_cast<int>(i);
  return -1;
}

std::optional<Pending> AudioQueue::nextTrack() const {
  const int i = appendedIndex();
  if (i > 0) return Pending{entries_[i]->track, entries_[i]->source};
  return held_;
}

EntryPtr AudioQueue::make(EntryKind kind, const Track& track, const Source& source, std::optional<double> startS,
                          std::vector<std::optional<std::string>> neighbours) {
  auto e = std::make_shared<QueueEntry>();
  e->mpvId = ++idAlloc_;
  e->kind = kind;
  e->track = track;
  e->source = source;
  e->startS = startS;
  e->neighbours = std::move(neighbours);
  if (kind == EntryKind::Advance && !entries_.empty()) e->fromKey = entries_.back()->track.trackKey;
  return e;
}

void AudioQueue::flushHeld(QueueResult& result) {
  if (!held_ || entries_.empty() || !entries_.back()->source.complete) return;
  if (appendedIndex() > 0) return;
  Pending p = std::move(*held_);
  held_.reset();
  auto entry = make(EntryKind::Advance, p.track, p.source, std::nullopt, {entries_.back()->track.albumKey});
  entries_.push_back(entry);
  result.ops.push_back(load(QueueOp::Mode::Append, entry));
}

void AudioQueue::dropAppendedNext(QueueResult& result) {
  const int index = appendedIndex();
  if (index < 0) return;
  entries_.erase(entries_.begin() + index);
  result.ops.push_back(simple(QueueOp::Kind::Remove, index));
}

QueueResult AudioQueue::replaceWith(EntryKind kind, const Track& track, const Source& source, std::optional<double> startS) {
  QueueResult result;
  // `loadfile replace` VIDE la liste de mpv : le suivant est retenu puis remis.
  const auto next = nextTrack();
  held_ = next;
  std::optional<std::string> before;
  if (kind == EntryKind::Advance && !entries_.empty()) before = entries_.front()->track.albumKey;
  auto entry = make(kind, track, source, startS, {before, next ? next->track.albumKey : std::nullopt});
  if (kind == EntryKind::Advance)
    entry->fromKey = entries_.empty() ? std::nullopt : std::optional<std::string>(entries_.front()->track.trackKey);
  entries_ = {entry};
  started_ = false;
  result.ops.push_back(load(QueueOp::Mode::Replace, entry));
  flushHeld(result);
  return result;
}

QueueResult AudioQueue::play(const Track& track, const Source& source, std::optional<double> startS) {
  held_.reset();
  entries_.clear();
  return replaceWith(EntryKind::Start, track, source, startS);
}

QueueResult AudioQueue::setNext(const std::optional<Track>& track, const std::optional<Source>& source) {
  QueueResult result;
  dropAppendedNext(result);
  held_ = track && source ? std::optional<Pending>(Pending{*track, *source}) : std::nullopt;
  flushHeld(result);
  return result;
}

QueueResult AudioQueue::stop() {
  entries_.clear();
  held_.reset();
  started_ = false;
  return {{simple(QueueOp::Kind::Stop)}, {}};
}

std::optional<QueueResult> AudioQueue::swap(const std::string& trackKey, const Source& source, const SwapContext& ctx) {
  if (held_ && held_->track.trackKey == trackKey) {
    held_->source = source;
    QueueResult result;
    flushHeld(result);
    return result;
  }
  const int nextIndex = appendedIndex(&trackKey);
  if (nextIndex > 0) {
    QueueResult result;
    EntryPtr old = entries_[nextIndex];
    entries_.erase(entries_.begin() + nextIndex);
    result.ops.push_back(simple(QueueOp::Kind::Remove, nextIndex));
    held_ = Pending{old->track, source};
    flushHeld(result);
    return result;
  }
  EntryPtr current = this->current();
  if (!current || current->track.trackKey != trackKey) return std::nullopt;
  return swapCurrent(current, source, ctx);
}

QueueResult AudioQueue::swapCurrent(const EntryPtr& current, const Source& source, const SwapContext& ctx) {
  // Pas encore lancé, ou arrêté sur une fin : rien n'est audible, on relit à la position.
  if (!ctx.started || ctx.atEnd)
    return replaceWith(EntryKind::Swap, current->track, source, ctx.started ? std::optional<double>(ctx.positionS) : current->startS);
  QueueResult result;
  const EntryPtr pending = pendingSwap();
  if (pending) {
    entries_.erase(entries_.begin() + 1);
    result.ops.push_back(simple(QueueOp::Kind::Remove, 1));
  }
  // Plus la place de basculer avant la fin : la source change pour les relectures.
  if (!ctx.swapAtS) {
    if (pending) result.ops.push_back(simple(QueueOp::Kind::ClearEnd));
    current->source = source;
    result.notices.push_back(swapped(current));
    flushHeld(result);
    return result;
  }
  auto entry = make(EntryKind::Swap, current->track, source, std::nullopt, current->neighbours);
  entry->edlFromS = ctx.swapAtS;
  entries_.insert(entries_.begin() + 1, entry);
  result.ops.push_back(simple(QueueOp::Kind::SetEnd, 0, *ctx.swapAtS - offsetOf(current)));
  result.ops.push_back(load(QueueOp::Mode::InsertNext, entry));
  flushHeld(result);  // un suivant retenu (titre incomplet) part derrière la nouvelle source
  return result;
}

QueueResult AudioQueue::seek(double positionS) {
  const EntryPtr pending = pendingSwap();
  const EntryPtr current = this->current();
  // Pendant une bascule en attente, le saut EST la bascule.
  if (pending && current) {
    entries_.erase(entries_.begin() + 1);
    return replaceWith(EntryKind::Swap, current->track, pending->source, positionS);
  }
  // Une entrée EDL ne remonte pas avant son début : on relit la source.
  if (current && positionS < offsetOf(current)) return replaceWith(EntryKind::Reload, current->track, current->source, positionS);
  return {{simple(QueueOp::Kind::Seek, 0, positionS - offsetOf(current))}, {}};
}

QueueResult AudioQueue::markCurrentComplete() {
  QueueResult result;
  const EntryPtr current = this->current();
  if (!current || current->source.complete) return result;
  current->source.complete = true;
  flushHeld(result);
  return result;
}

QueueResult AudioQueue::reload(double positionS) {
  const EntryPtr current = this->current();
  if (!current) return {};
  return replaceWith(EntryKind::Reload, current->track, current->source, positionS);
}

std::optional<QueueResult> AudioQueue::advanceHeld() {
  if (!held_) return std::nullopt;
  Pending p = std::move(*held_);
  held_.reset();
  return replaceWith(EntryKind::Advance, p.track, p.source, std::nullopt);
}

std::optional<QueueResult> AudioQueue::startFile(int64_t mpvId) {
  auto it = std::find_if(entries_.begin(), entries_.end(), [&](const EntryPtr& e) { return e->mpvId == mpvId; });
  if (it == entries_.end()) return std::nullopt;
  const size_t index = static_cast<size_t>(it - entries_.begin());
  QueueResult result;
  const EntryPtr entry = *it;
  if (entry->kind == EntryKind::Swap) {
    result.notices.push_back(swapped(entry));
  } else if (entry->kind == EntryKind::Advance) {
    QueueNotice n;
    n.type = QueueNotice::Kind::Advanced;
    n.fromKey = entry->fromKey;
    n.toKey = entry->track.trackKey;
    result.notices.push_back(n);
  }
  entry->kind = EntryKind::Start;  // l'entrée joue : un titre comme un autre
  for (size_t i = 0; i < index; i++) result.ops.push_back(simple(QueueOp::Kind::Remove, 0));
  entries_.erase(entries_.begin(), entries_.begin() + static_cast<long>(index));
  started_ = true;
  flushHeld(result);
  return result;
}

void AudioQueue::loadFailed(int64_t mpvId) {
  std::erase_if(entries_, [&](const EntryPtr& e) { return e->mpvId == mpvId; });
  for (auto& e : entries_)
    if (e->mpvId > mpvId) e->mpvId -= 1;
  idAlloc_ -= 1;
}

}  // namespace tentacle::music
