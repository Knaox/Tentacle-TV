#include "glue/mpv_player_port.h"

#include <SDL3/SDL.h>

#include <cstdio>
#include <cstdlib>
#include <sstream>

#include "compositor/compositor.h"
#include "platform/video_surface.h"
#include "player/player.h"
#include "shell/main_thread.h"
#include "shell/window_scale.h"

namespace bridge {
namespace {

tentacle::PropFormat formatOf(const std::string& f) {
  if (f == "flag") return tentacle::PropFormat::Flag;
  if (f == "int64") return tentacle::PropFormat::Int64;
  if (f == "double") return tentacle::PropFormat::Double;
  if (f == "node") return tentacle::PropFormat::Node;
  return tentacle::PropFormat::String;
}

}  // namespace

MpvPlayerPort::MpvPlayerPort(SDL_Window* window, void* nativeWindow, tentacle::Compositor* compositor,
                             tentacle::VideoSurface* restingLayer)
    : window_(window), nativeWindow_(nativeWindow), compositor_(compositor), restingLayer_(restingLayer) {
  int w = 0, h = 0;
  tentacle::windowSizeDip(window_, w, h);  // DIP : points sur macOS, pixels/échelle sous Windows
  widthPt_ = w;
  heightPt_ = h;
}

MpvPlayerPort::~MpvPlayerPort() {
  if (compositor_ && surface_) compositor_->setVideoLayer(restingLayer_);
  // Fermeture de l'app en pleine lecture : le lecteur AVANT sa surface (`Player::destroy` la
  // détache encore). Les membres partiraient dans l'ordre inverse : surface libérée, puis
  // `~Player` qui la touche (SIGSEGV à la sortie).
  player_.reset();
  surface_.reset();
}

bool MpvPlayerPort::running() const { return player_ != nullptr; }

void MpvPlayerPort::start(const Json& options, Done done) {
  tentacle::PlayerOptions opts;
  opts.post = [](std::function<void()> fn) { tentacle::postToMain(std::move(fn)); };
  for (const auto& [name, value] : options.items()) opts.options.emplace_back(name, value.get<std::string>());
  // Le son (sortie native, ou `ao=null` + `mute=yes` sous `--mute`) : `player/sound_policy.h`.
  // Journal de mpv pour les bancs (commandes, sortie audio, démuxeur) : jamais par la page.
  if (const char* log = std::getenv("TENTACLE_MPV_LOGFILE"); log && *log) {
    opts.logFile = log;
    if (const char* level = std::getenv("TENTACLE_MPV_LOGLEVEL"); level && *level) opts.logLevel = level;
  }
  // Bancs : options mpv en plus, `clé=valeur` séparées par des espaces (ex. `http-proxy=…` du
  // proxy lent de bench/lecteur). Après celles de la page ; le son et la sortie vidéo restent
  // au lecteur (`Player` les impose après).
  if (const char* extra = std::getenv("TENTACLE_MPV_EXTRA"); extra && *extra) {
    std::istringstream in(extra);
    for (std::string kv; in >> kv;)
      if (const auto eq = kv.find('='); eq != std::string::npos) opts.options.emplace_back(kv.substr(0, eq), kv.substr(eq + 1));
  }
  std::string error;
  player_ = tentacle::Player::create(std::move(opts), &error);
  if (!player_) return done(error.empty() ? "libmpv refuse de demarrer" : error);
  const int gen = ++*generation_;
  std::weak_ptr<int> alive = generation_;
  player_->onEvent([this, gen, alive](const Json& event) {
    if (auto g = alive.lock(); g && *g == gen && listener_) listener_->onEvent(event);
  });
  done(std::nullopt);
}

void MpvPlayerPort::stop(std::function<void()> done) {
  ++*generation_;  // plus aucun rappel de l'instance qui part
  // La couche quitte l'empilement tout de suite : la page reprend la main à l'écran.
  if (compositor_ && surface_) compositor_->setVideoLayer(restingLayer_);
  if (!player_) {
    surface_.reset();
    return done();
  }
  // `Player::destroy` coupe la sortie (mpv garde sa référence sur la couche jusqu'à la
  // fin de son VO) : la surface part APRÈS. L'instance et SA surface sont mises de côté —
  // une nouvelle lecture peut naître pendant ce temps avec les siennes.
  auto dying = std::make_shared<Dying>(Dying{std::move(player_), std::move(surface_)});
  dying_.push_back(dying);
  dying->player->destroy([this, dying, done]() {
    done();
    // Jamais détruire le lecteur dans son propre rappel : au tour suivant.
    tentacle::postToMain([this, dying]() { std::erase(dying_, dying); });
  });
}

bool MpvPlayerPort::ensureSurface(std::string* error) {
  if (surface_) return true;
  surface_ = nativeWindow_ ? tentacle::createVideoSurface(nativeWindow_) : nullptr;
  if (!surface_) {
    *error = "aucune surface video sur cette plateforme";
    return false;
  }
  surface_->setFrame({0, 0, widthPt_, heightPt_});
  if (compositor_) compositor_->setVideoLayer(surface_.get());
  surface_->show();
  if (!player_->attachVideoSurface(*surface_)) {
    *error = "le lecteur refuse la surface video";
    return false;
  }
  return true;
}

void MpvPlayerPort::command(const Json& args, Done done) {
  if (!player_) return done("mpv non initialise");
  // La couche naît au premier `loadfile` d'une vidéo, directement en PQ (voir l'en-tête).
  if (args.is_array() && !args.empty() && args[0] == "loadfile") {
    std::string error;
    if (!ensureSurface(&error)) return done(error);
  }
  player_->command(args, [done](std::optional<std::string> err, const Json&) { done(err); });
}

void MpvPlayerPort::setProperty(const std::string& name, const Json& value, Done done) {
  if (!player_) return done("mpv non initialise");
  player_->setProperty(name, value, [done](std::optional<std::string> err, const Json&) { done(err); });
}

void MpvPlayerPort::getProperty(const std::string& name, std::function<void(std::optional<Json>)> done) {
  if (!player_) return done(std::nullopt);
  player_->getProperty(name, std::move(done));  // asynchrone (mpv_get_property_async)
}

void MpvPlayerPort::observe(const std::string& name, const std::string& format) {
  if (!player_) return;
  const int gen = *generation_;
  std::weak_ptr<int> alive = generation_;
  player_->observe(name, formatOf(format), [this, name, gen, alive](const Json& value) {
    if (auto g = alive.lock(); g && *g == gen && listener_) listener_->onProperty(name, value);
  });
}

Json MpvPlayerPort::surfaceState() const {
  if (!surface_) return nullptr;
  const auto c = surface_->colorState();
  const auto px = surface_->pixelSize();
  return {{"colorspace", c.colorspace}, {"pixelFormat", c.pixelFormat}, {"wantsEdr", c.wantsEdr},
          {"hasEdrMetadata", c.hasEdrMetadata}, {"opaque", c.opaque}, {"visible", surface_->visible()},
          {"pixelSize", {px.w, px.h}},
          {"window", {{"fullscreen", c.windowFullscreen}, {"w", c.windowFrame.width}, {"h", c.windowFrame.height}}}};
}

void MpvPlayerPort::windowResized(double widthPt, double heightPt) {
  widthPt_ = widthPt;
  heightPt_ = heightPt;
  if (surface_) surface_->setFrame({0, 0, widthPt_, heightPt_});
}

}  // namespace bridge
