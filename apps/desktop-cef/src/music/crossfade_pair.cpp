#include "music/crossfade_pair.h"

#include <algorithm>
#include <cstdio>

namespace tentacle::music {

// --- Un fondu en cours ------------------------------------------------------------------

DeckFade::DeckFade(Deck* from, Deck* to, PendingFade pending, std::optional<std::string> fromKey, std::function<void()> mid,
                   std::function<void()> end, Scheduler& scheduler)
    : from(from),
      to(to),
      pending(std::move(pending)),
      fromKey(std::move(fromKey)),
      mid_(std::move(mid)),
      end_(std::move(end)),
      scheduler_(scheduler),
      timers_(scheduler),
      since_(scheduler.nowMs()) {
  schedule();
}

void DeckFade::schedule() {
  const double fadeMs = pending.fadeS * 1000;
  if (!passedMid) timers_.after(static_cast<int>(std::max(0.0, fadeMs / 2 - elapsedMs_)), mid_);
  timers_.after(static_cast<int>(std::max(0.0, fadeMs + kTailMs - elapsedMs_)), end_);
}

void DeckFade::pause() {
  if (!running_) return;
  running_ = false;
  elapsedMs_ += scheduler_.nowMs() - since_;
  cancel();
  for (Deck* d : {from, to}) d->control(Control::of("pause"));
}

void DeckFade::resume() {
  if (running_) return;
  running_ = true;
  since_ = scheduler_.nowMs();
  // Le titre qui part et qui a déjà fini se tait : relancé, il repartirait de son début.
  if (!from->timeline().ended) from->control(Control::of("resume"));
  to->control(Control::of("resume"));
  schedule();
}

void DeckFade::cancel() { timers_.cancelAll(); }

// --- Les deux instances -----------------------------------------------------------------

DeckPair::DeckPair(Scheduler& scheduler, DeckFactory make, OnEvent onEvent)
    : scheduler_(scheduler), factory_(std::move(make)), onEvent_(std::move(onEvent)), timers_(scheduler) {
  front = this->make();
}

Deck* DeckPair::make() {
  // Le deck ne se connaît pas encore à sa naissance : la case est remplie juste après.
  auto self = std::make_shared<Deck*>(nullptr);
  std::weak_ptr<bool> alive = alive_;
  auto deck = factory_([this, alive, self](const nlohmann::json& event) {
    if (!alive.expired() && *self) onEvent_(*self, event);
  });
  *self = deck.get();
  owned_.push_back(std::move(deck));
  return *self;
}

void DeckPair::retire(Deck* deck) {
  auto it = std::find_if(owned_.begin(), owned_.end(), [deck](const auto& d) { return d.get() == deck; });
  if (it == owned_.end()) return;
  disposing_.push_back(std::move(*it));
  owned_.erase(it);
  std::weak_ptr<bool> alive = alive_;
  deck->dispose([this, alive, deck] {
    if (alive.expired()) return;
    scheduler_.post([this, alive, deck] {
      if (alive.expired()) return;
      std::erase_if(disposing_, [deck](const auto& d) { return d.get() == deck; });
    });
  });
}

std::vector<Deck*> DeckPair::all() const { return back ? std::vector<Deck*>{front, back} : std::vector<Deck*>{front}; }

void DeckPair::bringForward(Deck* deck) {
  if (deck == front) return;
  back = front;
  front = deck;
}

void DeckPair::start(const StartSettings& start, Deck::StartDone done) {
  startArgs_ = start;
  std::weak_ptr<bool> alive = alive_;
  front->start(start, [this, alive, start, done](std::optional<std::string> error, nlohmann::json caps) {
    if (error || alive.expired() || !back || !backReady) return done(error, caps);
    back->start(start, [done, error, caps](std::optional<std::string>, nlohmann::json) { done(error, caps); });
  });
}

void DeckPair::ensureBack(std::function<void()> ready) {
  if (back || !startArgs_) return;
  Deck* deck = make();
  back = deck;
  std::weak_ptr<bool> alive = alive_;
  deck->start(*startArgs_, [this, alive, deck, ready](std::optional<std::string> error, nlohmann::json) {
    if (alive.expired() || back != deck) return;
    if (error) {
      std::fprintf(stderr, "[music] seconde instance de la transition douce refusée : %s\n", error->c_str());
      back = nullptr;
      return retire(deck);
    }
    for (const auto& [_, c] : settings_) deck->control(c);
    chain(deck);
    backReady = true;
    ready();
  });
}

void DeckPair::releaseBack() {
  Deck* deck = back;
  if (!deck) return;
  cancelCut(deck);
  back = nullptr;
  backReady = false;
  chained_.erase(deck);
  retire(deck);
}

void DeckPair::chain(Deck* deck) {
  if (chained_.count(deck)) return;
  deck->setChain(std::string("1"));
  chained_.insert(deck);
}

void DeckPair::apply(const Control& c) {
  settings_[c.action] = c;
  for (Deck* d : all()) d->control(c);
}

std::pair<Deck*, int> DeckPair::gesture(DeckFade* fading, bool crossfade) {
  // Pendant un fondu, les deux sonnent : tous deux sortent, le nouveau attend qu'une instance ait fini.
  if (fading) {
    cutOut(fading->from);
    cutOut(fading->to);
    bringForward(fading->to);
    return {fading->to, kManualCutMs + kTailMs};
  }
  Deck* reserve = back;
  if (crossfade && backReady && reserve && isChained(front) && front->timeline().playing) {
    Deck* leaving = front;
    bringForward(reserve);
    cutOut(leaving);
  } else if (reserve) {
    reserve->control(Control::of("stop"));
  }
  return {front, 0};
}

void DeckPair::cutOut(Deck* deck) {
  cancelCut(deck);
  std::vector<Timers::Id> ids;
  const auto steps = cutSteps(kManualCutMs);
  for (size_t i = 0; i < steps.size(); i++) {
    char gain[32];
    std::snprintf(gain, sizeof gain, "%.4f", steps[i]);
    ids.push_back(timers_.after(static_cast<int>(i) * kCutStepMs, [deck, g = std::string(gain)] { deck->setGain(g); }));
  }
  ids.push_back(timers_.after(kManualCutMs + kTailMs, [this, deck] {
    cuts_.erase(deck);
    if (deck != front) deck->control(Control::of("stop"));
    onCutDone();
  }));
  cuts_[deck] = std::move(ids);
}

void DeckPair::cancelCut(Deck* deck) {
  auto it = cuts_.find(deck);
  if (it == cuts_.end()) return;
  for (auto id : it->second) timers_.cancel(id);
  cuts_.erase(it);
}

void DeckPair::dispose(std::function<void()> done) {
  for (auto& [deck, ids] : cuts_)
    for (auto id : ids) timers_.cancel(id);
  cuts_.clear();
  auto left = std::make_shared<size_t>(owned_.size());
  if (*left == 0) return done();
  std::vector<Deck*> decks;
  for (const auto& d : owned_) decks.push_back(d.get());
  for (Deck* d : decks)
    d->dispose([left, done] {
      if (--*left == 0) done();
    });
}

}  // namespace tentacle::music
