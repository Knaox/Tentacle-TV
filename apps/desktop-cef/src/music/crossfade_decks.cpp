#include "music/crossfade_decks.h"

#include <algorithm>

namespace tentacle::music {
namespace {

constexpr double kMaxFadeS = 12;
using json = nlohmann::json;

}  // namespace

CrossfadeDecks::CrossfadeDecks(Scheduler& scheduler, DeckFactory make, DeckEmit emit)
    : scheduler_(scheduler),
      emit_(std::move(emit)),
      timers_(scheduler),
      pair_(scheduler, std::move(make), [this](Deck* d, const json& e) { onDeck(d, e); }) {
  // La réserve sortait (un geste) : le suivant s'y charge maintenant.
  pair_.onCutDone = [this] { preparePending(); };
}

CrossfadeDecks::~CrossfadeDecks() { timers_.cancelAll(); }

void CrossfadeDecks::ensureBack() {
  if (available()) pair_.ensureBack([this] { preparePending(); });
}

void CrossfadeDecks::start(const StartSettings& start, Deck::StartDone done) {
  exclusive_ = start.exclusive;
  pair_.start(start, [this, done](std::optional<std::string> error, json caps) {
    if (!error) ensureBack();
    done(error, std::move(caps));
  });
}

void CrossfadeDecks::onDeck(Deck* d, const json& event) {
  const std::string type = event.value("type", "");
  if (type == "needSource") {
    if (d == pair_.front || (prepared_ && d == pair_.back) || (fade_ && fade_->to == d)) emit_(event);
    return;
  }
  if (d != pair_.front) return;
  if (type == "advanced") {
    frontKey_ = event.contains("toKey") && event["toKey"].is_string() ? std::optional<std::string>(event["toKey"].get<std::string>()) : std::nullopt;
    fadedIn_.reset();
  }
  if (type != "state") return emit_(event);
  // Le titre qui part finit avant la mi-fondu (durée annoncée trop longue) : le suivant passe devant.
  if (fade_ && !fade_->passedMid && event["state"].value("status", "") == "ended") return passMid();
  emit_(event);
  if (!fade_) arm();
}

void CrossfadeDecks::arm() {
  Deck* back = pair_.back;
  if (!pending_ || !back || !prepared_ || timers_.pending(armTimer_) || paused_ || !pair_.isChained(pair_.front)) return;
  const ArmDecision decision = armDecision(pair_.front->timeline(), pending_->fadeS);
  if (decision.kind == ArmDecision::Kind::Wait) return;
  if (decision.kind == ArmDecision::Kind::Late) return giveUp();
  // Le suivant n'a pas fini de se charger : on réessaie au prochain état.
  if (!back->timeline().loaded) return;
  pair_.front->setGain(fadeOutExpr(decision.startS, pending_->fadeS));
  armTimer_ = timers_.after(decision.delayMs, [this] { startFade(); });
}

void CrossfadeDecks::clearArm() {
  if (!timers_.pending(armTimer_)) return;
  timers_.cancel(armTimer_);
  armTimer_ = 0;
  pair_.front->setGain("1");
}

void CrossfadeDecks::giveUp() {
  if (!pending_) return;
  PendingFade p = std::move(*pending_);
  dropPrepared();
  pending_.reset();
  pair_.front->setNext(p.track, p.source);
}

void CrossfadeDecks::startFade() {
  armTimer_ = 0;
  Deck* from = pair_.front;
  Deck* to = pair_.back;
  if (!to || !pending_) return;
  PendingFade p = std::move(*pending_);
  pending_.reset();
  prepared_ = false;
  to->control(Control::of("resume"));
  fade_ = std::make_unique<DeckFade>(from, to, std::move(p), frontKey_, [this] { passMid(); }, [this] { finish(); }, scheduler_);
}

void CrossfadeDecks::passMid() {
  if (!fade_ || fade_->passedMid) return;
  fade_->passedMid = true;
  pair_.bringForward(fade_->to);
  frontKey_ = fade_->pending.track.trackKey;
  fadedIn_ = FadedIn{fade_->pending, fade_->to};
  emit_({{"type", "advanced"}, {"fromKey", fade_->fromKey ? json(*fade_->fromKey) : json(nullptr)}, {"toKey", fade_->pending.track.trackKey}});
}

void CrossfadeDecks::finish() {
  if (!fade_) return;
  passMid();
  std::unique_ptr<DeckFade> f = std::move(fade_);
  f->cancel();
  f->from->control(Control::of("stop"));
  auto swaps = std::move(deferredSwaps_);
  deferredSwaps_.clear();
  for (const auto& [key, source] : swaps) swap(key, source);
  preparePending();
}

void CrossfadeDecks::preparePending() {
  Deck* back = pair_.back;
  if (!pending_ || !back || !pair_.backReady || fade_ || prepared_ || pair_.isCutting(back)) return;
  pair_.chain(back);
  Source faded = pending_->source;
  faded.fadeInS = pending_->fadeS;
  back->play(pending_->track, faded, 0, true);
  prepared_ = true;
}

void CrossfadeDecks::dropPrepared() {
  if (!prepared_) return;
  prepared_ = false;
  if (pair_.back) pair_.back->control(Control::of("stop"));
}

void CrossfadeDecks::abortFade(bool keep) {
  if (!fade_) return;
  std::unique_ptr<DeckFade> f = std::move(fade_);
  f->cancel();
  if (f->passedMid) return pair_.cutOut(f->from);
  f->to->control(Control::of("stop"));
  pair_.front->setGain("1");
  if (!keep) return;
  pending_ = f->pending;
  preparePending();
}

void CrossfadeDecks::play(const Track& track, const Source& source, double startMs) {
  clearArm();
  dropPrepared();
  cancelDelayed();
  pending_.reset();
  fadedIn_.reset();
  paused_ = false;
  frontKey_ = track.trackKey;
  std::unique_ptr<DeckFade> fading = std::move(fade_);
  if (fading) fading->cancel();
  const auto [deck, delayMs] = pair_.gesture(fading.get(), available());
  if (delayMs == 0) return startOn(deck, track, source, startMs);
  delayed_ = timers_.after(delayMs, [this, deck, track, source, startMs] { startOn(deck, track, source, startMs); });
}

void CrossfadeDecks::startOn(Deck* deck, const Track& track, const Source& source, double startMs) {
  delayed_ = 0;
  pair_.cancelCut(deck);
  if (available()) pair_.chain(deck);
  deck->play(track, source, startMs);
}

void CrossfadeDecks::cancelDelayed() {
  timers_.cancel(delayed_);
  delayed_ = 0;
}

void CrossfadeDecks::setNext(const std::optional<Track>& track, const std::optional<Source>& source, double crossfadeMs) {
  if (fade_ && !fade_->passedMid && track && track->trackKey == fade_->pending.track.trackKey) return;
  if (fade_ && !fade_->passedMid) abortFade(false);
  clearArm();
  const double fadeS = std::min(kMaxFadeS, crossfadeMs / 1000);
  // Le titre qui joue sans gain de fondu (transition allumée en pleine écoute) : l'enchaînement d'avant.
  if (track && source && fadeS > 0 && available() && pair_.back && pair_.isChained(pair_.front)) {
    const auto& p = pending_;
    if (p && p->track.trackKey == track->trackKey && p->source.url == source->url && p->fadeS == fadeS) return;
    dropPrepared();
    pending_ = PendingFade{*track, *source, fadeS};
    pair_.front->setNext(std::nullopt, std::nullopt);
    preparePending();
    return;
  }
  dropPrepared();
  pending_.reset();
  pair_.front->setNext(track, source);
}

void CrossfadeDecks::swap(const std::string& trackKey, const Source& source) {
  // Pendant un fondu, la bascule attend sa fin : la courbe d'un titre ne se perd pas dans une relecture.
  if (fade_ && (trackKey == fade_->pending.track.trackKey || trackKey == fade_->fromKey)) {
    deferredSwaps_[trackKey] = source;
    return;
  }
  if (pending_ && pending_->track.trackKey == trackKey) {
    pending_->source = source;
    dropPrepared();
    return preparePending();
  }
  if (fadedIn_ && fadedIn_->pending.track.trackKey == trackKey) fadedIn_->pending.source = source;
  pair_.front->swap(trackKey, source);
}

void CrossfadeDecks::control(const Control& c) {
  if (c.action == "pause") {
    paused_ = true;
    clearArm();
    if (fade_) fade_->pause();
    pair_.front->control(c);
  } else if (c.action == "resume") {
    paused_ = false;
    if (fade_) fade_->resume();
    pair_.front->control(c);
  } else if (c.action == "stop") {
    clearArm();
    cancelDelayed();
    dropPrepared();
    pending_.reset();
    if (fade_) fade_->cancel();
    fade_.reset();
    for (Deck* d : pair_.all()) d->control(c);
  } else if (c.action == "seek") {
    seek(c.value);
  } else if (c.action == "crossfade") {
    setCrossfade(c.value);
  } else {
    pair_.apply(c);
  }
}

void CrossfadeDecks::seek(double valueMs) {
  if (fade_) abortFade(!fade_->passedMid);
  clearArm();
  // Un saut dans la courbe d'entrée d'un titre entré par un fondu : relu à la cible, sans elle.
  if (fadedIn_ && fadedIn_->deck == pair_.front && valueMs / 1000 < fadedIn_->pending.fadeS) {
    FadedIn fi = std::move(*fadedIn_);
    fadedIn_.reset();
    return pair_.front->play(fi.pending.track, fi.pending.source, valueMs, paused_);
  }
  pair_.front->control(Control::of("seek", valueMs));
}

void CrossfadeDecks::setCrossfade(double ms) {
  crossfadeMs_ = std::max(0.0, std::min(kMaxFadeS * 1000, ms));
  if (available()) return ensureBack();
  giveUp();
  if (!fade_) pair_.releaseBack();
}

void CrossfadeDecks::setOutput(const std::optional<std::string>& deviceId, bool exclusive, Deck::Done done) {
  const bool changed = exclusive != exclusive_;
  exclusive_ = exclusive;
  if (changed) {
    // La chaîne suit le mode exclusif : le gain du fondu repart à la prochaine lecture.
    if (fade_) abortFade(false);
    giveUp();
    pair_.forgetChains();
  }
  const auto decks = pair_.all();
  struct Join {
    size_t left;
    std::optional<std::string> error;
  };
  auto join = std::make_shared<Join>(Join{decks.size(), std::nullopt});
  for (Deck* d : decks)
    d->setOutput(deviceId, exclusive, [this, join, done](std::optional<std::string> error) {
      if (error && !join->error) join->error = error;
      if (--join->left > 0) return;
      if (available()) ensureBack();
      else if (!fade_) pair_.releaseBack();
      done(join->error);
    });
}

void CrossfadeDecks::sourceCut(const std::string& url) {
  for (Deck* d : pair_.all()) d->sourceCut(url);
}

void CrossfadeDecks::dispose(std::function<void()> done) {
  clearArm();
  cancelDelayed();
  if (fade_) fade_->cancel();
  pair_.dispose(std::move(done));
}

}  // namespace tentacle::music
