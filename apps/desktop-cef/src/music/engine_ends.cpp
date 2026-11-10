#include "music/engine_ends.h"

#include <algorithm>
#include <cstdio>

#include "music/audio_options.h"

namespace tentacle::music {

bool isCut(const CutContext& ctx) {
  if ((ctx.origin != "plugin" && !ctx.error) || !ctx.durationMs || *ctx.durationMs <= 0) return false;
  return ctx.positionMs > 0 && ctx.positionMs < *ctx.durationMs - kCutMarginMs && ctx.reloads < kMaxCutReloads;
}

// --- Coupures, comptées par titre ------------------------------------------------------

void CutReloads::follow(const std::string& trackKey) {
  if (key_ == trackKey) return;
  key_ = trackKey;
  count_ = 0;
  lastS_.reset();
  resumedS_.reset();
}

void CutReloads::played(const std::string& trackKey, double positionS) {
  follow(trackKey);
  lastS_ = positionS;
  // La lecture a nettement repris : un défaut plus loin a de nouveau ses relectures.
  if (resumedS_ && (positionS - *resumedS_) * 1000 >= kCutProgressMs) {
    count_ = 0;
    resumedS_.reset();
  }
}

std::optional<double> CutReloads::take(const std::string& trackKey, const std::string& origin, std::optional<double> durationMs, bool error) {
  follow(trackKey);
  if (!lastS_ || !durationMs || !isCut({origin, durationMs, *lastS_ * 1000, count_, error})) return std::nullopt;
  const double skipMs = count_ < 3 ? kCutSkipsMs[count_] : 0;
  const double at = std::min(*lastS_ + skipMs / 1000, (*durationMs - kCutMarginMs) / 1000);
  count_ += 1;
  lastS_ = at;
  resumedS_ = at;
  return at;
}

std::optional<double> CutReloads::takeSignaled(const std::string& trackKey) {
  follow(trackKey);
  if (count_ >= kMaxCutReloads) return std::nullopt;
  count_ += 1;
  return lastS_.value_or(0);
}

void CutReloads::reset() {
  key_.reset();
  count_ = 0;
  lastS_.reset();
  resumedS_.reset();
}

// --- Fin provisoire --------------------------------------------------------------------

void ProvisionalEnd::reset() {
  cancel();
  stalled_ = 0;
  lastAtMs_.reset();
}

void ProvisionalEnd::cancel() {
  timers_.cancel(timer_);
  timer_ = 0;
}

void ProvisionalEnd::schedule(std::function<bool()> still, std::function<double()> positionMs, std::function<void(double)> reload) {
  if (pending()) return;
  timer_ = timers_.after(reloadDelayMs(stalled_), [this, still, positionMs, reload] {
    timer_ = 0;
    if (!still()) return;
    const double at = positionMs();
    if (!progressed(lastAtMs_, at)) stalled_ += 1;
    lastAtMs_ = at;
    reload(at / 1000);
  });
}

// --- Les fins du moteur ----------------------------------------------------------------

void FileEnds::played() {
  const EntryPtr current = host_.queue->current();
  if (!current) return;
  cuts.played(current->track.trackKey, host_.positionS());
  if (signaled_.erase(current->source.url)) reloadSignaled(current);
}

void FileEnds::sourceCut(const std::string& url) {
  const EntryPtr current = host_.queue->current();
  if (current && current->source.url == url && host_.queue->isStarted()) reloadSignaled(current);
  else signaled_.insert(url);
}

void FileEnds::endFile(int64_t mpvId, EndKind kind, int error) {
  const EntryPtr current = host_.queue->current();
  if (!current || current->mpvId != mpvId) return;
  if (kind != EndKind::Other && reloadCut(current, kind == EndKind::Error)) return;
  if (kind == EndKind::Error) host_.fail("end-file " + std::to_string(error), current);
}

void FileEnds::eof() {
  AudioQueue& queue = *host_.queue;
  const EntryPtr current = queue.current();
  if (!current || !queue.isStarted() || host_.flags().awaitingRestart || provisional.pending()) return;
  EndContext ctx;
  ctx.complete = current->source.complete;
  ctx.durationMs = durationOf(current, host_.props());
  ctx.positionMs = host_.positionS() * 1000;
  ctx.stalledReloads = provisional.stalledReloads();
  if (!isRealEnd(ctx)) {
    host_.flags().reloading = true;
    provisional.schedule([this, current] { return host_.queue->current() == current && host_.props().eofReached; },
                         [this] { return host_.positionS() * 1000; },
                         [this](double positionS) { host_.run(host_.queue->reload(positionS)); });
    host_.emitState();
    return;
  }
  if (reloadCut(current)) return;
  if (auto next = queue.advanceHeld()) host_.run(std::move(*next));
  else host_.stopAtEnd();
}

void FileEnds::clearReload() {
  provisional.cancel();
  host_.flags().reloading = false;
}

void FileEnds::reloadSignaled(const EntryPtr& current) {
  const auto at = cuts.takeSignaled(current->track.trackKey);
  if (!at) return;
  std::fprintf(stderr, "[music] source coupée à %.1f s (relais) : relue à la position\n", *at);
  host_.run(host_.queue->pendingSwap() ? host_.queue->seek(*at) : host_.queue->reload(*at));
}

bool FileEnds::reloadCut(const EntryPtr& current, bool error) {
  AudioQueue& queue = *host_.queue;
  if (!queue.isStarted() || host_.swapScheduled() || queue.pendingSwap()) return false;
  const auto at = cuts.take(current->track.trackKey, current->source.origin, durationOf(current, host_.props()), error);
  if (!at) return false;
  std::fprintf(stderr, "[music] coupure à %.1f s : relue à la position\n", *at);
  host_.run(queue.reload(*at));
  return true;
}

}  // namespace tentacle::music
