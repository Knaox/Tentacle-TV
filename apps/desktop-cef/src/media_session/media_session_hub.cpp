#include "media_session/media_session_hub.h"

#include <cmath>

namespace tentacle::media_session {
namespace {

constexpr size_t kArtworkCacheEntries = 8;

// Sans couture d'OS (bus absent, API refusée) : le cœur tourne quand même, rien ne s'affiche.
class NullBackend final : public Backend {
 public:
  void activate() override {}
  void deactivate() override {}
  void setNowPlaying(const NowPlaying&, std::shared_ptr<const Artwork>) override {}
  void setPlayback(const Playback&) override {}
  void setControls(const Controls&) override {}
};

// Où l'OS croit être : la position transmise, avancée au rythme de la lecture.
double extrapolated(const Playback& p, double nowMs) {
  if (p.status != Status::Playing) return p.positionMs;
  return p.positionMs + (nowMs - p.atMs) * p.rate;
}

}  // namespace

Hub::Hub(std::unique_ptr<Backend> backend, Fetch fetch, Clock clock)
    : backend_(std::move(backend)), fetch_(std::move(fetch)), clock_(std::move(clock)) {
  real_ = backend_ != nullptr;
  if (!backend_) backend_ = std::make_unique<NullBackend>();
}

Hub::~Hub() {
  *alive_ = false;
  if (shown_) backend_->deactivate();
}

void Hub::claim(Kind kind, Handler handler) {
  Slot& s = slot(kind);
  s.claimed = true;
  s.handler = std::move(handler);
  s.claimSeq = ++seq_;
  recompute();
}

void Hub::release(Kind kind) {
  Slot& s = slot(kind);
  s = Slot{};  // une source relâchée repart de rien (titre, état, pochette)
  recompute();
}

void Hub::setNowPlaying(Kind kind, const NowPlaying& now) {
  Slot& s = slot(kind);
  if (s.now && *s.now == now) return;
  const bool newArtwork = !s.now || s.now->artworkUrl != now.artworkUrl;
  s.now = now;
  s.now->kind = kind;
  if (newArtwork) fetchArtwork(kind);
  if (shown_ == kind) backend_->setNowPlaying(*s.now, s.artwork);
  else recompute();
}

void Hub::setPlayback(Kind kind, Playback playback) {
  Slot& s = slot(kind);
  const double now = clock_();
  playback.atMs = now;
  playback.seeked = false;
  if (playback.status == Status::Playing && s.playback.status != Status::Playing) s.playingSeq = ++seq_;
  s.playback = playback;
  if (shown_ != kind) return recompute();
  const Playback& sent = s.sent;
  const bool shape = sent.status != playback.status || sent.rate != playback.rate || sent.durationMs != playback.durationMs;
  const double drift = std::fabs(extrapolated(sent, now) - playback.positionMs);
  const bool jump = drift > (playback.status == Status::Playing ? kJumpMs : 500.0);
  if (shape || jump) pushPlayback(s, jump);
  recompute();  // une source qui se met à jouer peut passer devant l'autre
}

void Hub::setControls(Kind kind, const Controls& controls) {
  Slot& s = slot(kind);
  if (s.controls == controls) return;
  s.controls = controls;
  if (shown_ == kind) backend_->setControls(controls);
}

void Hub::setAudioSessionName(const std::string& name) { backend_->setAudioSessionName(name); }

void Hub::dispatch(const CommandEvent& event) {
  if (!shown_) return;
  Slot& s = slot(*shown_);
  if (s.handler) s.handler(event);
}

std::optional<Kind> Hub::elect() const {
  std::optional<Kind> best;
  std::pair<int, uint64_t> bestRank{-1, 0};
  for (Kind k : {Kind::Music, Kind::Video}) {
    const Slot& s = slot(k);
    if (!s.claimed || !s.now) continue;
    // Une source qui JOUE passe devant ; entre deux, la plus récente à s'être mise à jouer.
    const std::pair<int, uint64_t> rank =
        s.playback.status == Status::Playing ? std::pair<int, uint64_t>{1, s.playingSeq} : std::pair<int, uint64_t>{0, s.claimSeq};
    if (rank > bestRank) {
      bestRank = rank;
      best = k;
    }
  }
  return best;
}

void Hub::recompute() {
  const std::optional<Kind> next = elect();
  if (next == shown_) return;
  const bool wasShown = shown_.has_value();
  shown_ = next;
  if (!next) return backend_->deactivate();
  if (!wasShown) backend_->activate();
  pushAll(*next);
}

void Hub::pushAll(Kind kind) {
  Slot& s = slot(kind);
  backend_->setNowPlaying(*s.now, s.artwork);
  backend_->setControls(s.controls);
  pushPlayback(s, false);
}

void Hub::pushPlayback(Slot& s, bool seeked) {
  s.sent = s.playback;
  s.sent.seeked = seeked;
  backend_->setPlayback(s.sent);
}

void Hub::fetchArtwork(Kind kind) {
  Slot& s = slot(kind);
  const std::string url = s.now ? s.now->artworkUrl : std::string();
  s.artworkGen = ++seq_;  // jamais réutilisé, même après un `release`
  s.artworkFor = url;
  s.artwork = cached(url);
  if (url.empty() || s.artwork || !fetch_) return;
  const uint64_t gen = s.artworkGen;
  std::weak_ptr<bool> alive = alive_;
  fetch_(url, [this, alive, kind, gen, url](std::shared_ptr<const Artwork> artwork) {
    if (alive.expired()) return;
    if (artwork) remember(url, artwork);
    Slot& target = slot(kind);
    // Le titre a changé pendant le téléchargement : cette pochette n'est plus la sienne.
    if (target.artworkGen != gen || target.artworkFor != url || !artwork || !target.now) return;
    target.artwork = std::move(artwork);
    if (shown_ == kind) backend_->setNowPlaying(*target.now, target.artwork);
  });
}

std::shared_ptr<const Artwork> Hub::cached(const std::string& url) const {
  for (const auto& [u, a] : artworkCache_)
    if (u == url) return a;
  return nullptr;
}

void Hub::remember(const std::string& url, std::shared_ptr<const Artwork> artwork) {
  if (cached(url)) return;
  artworkCache_.emplace_back(url, std::move(artwork));
  while (artworkCache_.size() > kArtworkCacheEntries) artworkCache_.pop_front();
}

Hub::Snapshot Hub::snapshot() const {
  Snapshot out;
  out.shown = shown_;
  if (!shown_) return out;
  const Slot& s = slot(*shown_);
  if (s.now) out.now = *s.now;
  out.playback = s.sent;
  out.controls = s.controls;
  out.artwork = s.artwork != nullptr;
  out.artworkBytes = s.artwork ? s.artwork->bytes.size() : 0;
  return out;
}

}  // namespace tentacle::media_session
