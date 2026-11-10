#include "glass/glass_video.h"

#include <mpv/client.h>

#include <chrono>
#include <cstring>
#include <memory>
#include <string>

#include "compositor/compositor.h"
#include "glass/video_layout.h"
#include "glue/pont_shell.h"
#include "player/player.h"
#include "shell/main_thread.h"

namespace tentacle::glass {
namespace {

/// La page en demande une toutes les 2 s, contrôles affichés : une par seconde au plus.
constexpr double kMinIntervalMs = 1000;
/// Une instance arrêtée en vol ne répond plus (`Player::destroy` oublie ses réponses) : au-delà,
/// la vidéo ne dit rien, et la file repart.
constexpr int64_t kGiveUpMs = 3000;

double nowMs() {
  using namespace std::chrono;
  return duration<double, std::milli>(steady_clock::now().time_since_epoch()).count();
}

/// Les champs de l'image rendue par `screenshot-raw` (un nœud MAP), lus EN PLACE.
struct Frame {
  int64_t width = 0, height = 0, stride = 0;
  const uint8_t* data = nullptr;
  size_t size = 0;
};

std::optional<Frame> readFrame(const mpv_node* top) {
  if (top == nullptr || top->format != MPV_FORMAT_NODE_MAP || top->u.list == nullptr) return std::nullopt;
  Frame f;
  std::string format;
  const mpv_node_list* list = top->u.list;
  for (int i = 0; i < list->num; ++i) {
    const char* key = list->keys[i];
    const mpv_node& v = list->values[i];
    if (v.format == MPV_FORMAT_INT64) {
      if (std::strcmp(key, "w") == 0) f.width = v.u.int64;
      else if (std::strcmp(key, "h") == 0) f.height = v.u.int64;
      else if (std::strcmp(key, "stride") == 0) f.stride = v.u.int64;
    } else if (v.format == MPV_FORMAT_STRING && std::strcmp(key, "format") == 0) {
      format = v.u.string;
    } else if (v.format == MPV_FORMAT_BYTE_ARRAY && std::strcmp(key, "data") == 0 && v.u.ba != nullptr) {
      f.data = static_cast<const uint8_t*>(v.u.ba->data);
      f.size = v.u.ba->size;
    }
  }
  if (format != "bgra" || f.data == nullptr || f.width <= 0 || f.height <= 0 || f.stride < f.width * 4 ||
      static_cast<size_t>(f.stride * f.height) > f.size)
    return std::nullopt;
  return f;
}

}  // namespace

void VideoGrabber::grab(std::vector<std::optional<Box>> boxes, std::function<void(std::optional<platform::Grids>)> done) {
  queue_.push_back(Job{std::move(boxes), std::move(done)});
  if (!busy_) next();
}

void VideoGrabber::next() {
  if (queue_.empty()) {
    busy_ = false;
    return;
  }
  busy_ = true;
  Job job = std::move(queue_.front());
  queue_.pop_front();
  const double wait = lastShotMs_ + kMinIntervalMs - nowMs();
  if (wait > 0) {
    auto shared = std::make_shared<Job>(std::move(job));
    postToMainDelayed([this, shared, alive = std::weak_ptr<int>(alive_)] {
      if (alive.lock()) shoot(std::move(*shared));
    }, static_cast<int64_t>(wait));
  } else {
    shoot(std::move(job));
  }
}

void VideoGrabber::shoot(Job job) {
  // Une seule réponse, la première : celle de mpv, ou l'abandon.
  auto answered = std::make_shared<bool>(false);
  auto finish = [this, answered, done = job.done, alive = std::weak_ptr<int>(alive_)](std::optional<platform::Grids> grids) {
    if (*answered) return;
    *answered = true;
    done(std::move(grids));
    if (alive.lock()) next();
  };
  Player* player = pont::videoPlayer();
  RectPt frame;
  if (player == nullptr || compositor_ == nullptr || !compositor_->shownVideoFrame(&frame)) return finish(std::nullopt);
  postToMainDelayed([finish] { finish(std::nullopt); }, kGiveUpMs);
  const Box window{frame.x, frame.y, frame.width, frame.height};
  auto boxes = std::make_shared<std::vector<std::optional<Box>>>(std::move(job.boxes));
  player->getProperty("video-params", [this, player, window, boxes, finish, answered,
                                       alive = std::weak_ptr<int>(alive_)](std::optional<Json> params) {
    if (*answered || !alive.lock() || pont::videoPlayer() != player) return finish(std::nullopt);  // une autre lecture
    const auto aspect = params ? displayAspect(*params) : std::nullopt;
    const auto layout = aspect ? videoLayout(window, *aspect) : std::nullopt;
    if (!layout) return finish(std::nullopt);
    auto points = std::make_shared<std::vector<std::optional<std::vector<GridPoint>>>>();
    for (const auto& box : *boxes)
      points->push_back(box ? std::optional(gridPoints(*layout, *box)) : std::nullopt);
    lastShotMs_ = nowMs();
    auto grids = std::make_shared<platform::Grids>();
    // Lue PENDANT la réponse, puis mpv libère l'image : la grille seule traverse.
    const auto read = [points, grids](const void* node) -> Json {
      const auto f = readFrame(static_cast<const mpv_node*>(node));
      if (!f) return false;
      const auto pixel = [&f](int x, int y) {
        uint32_t word;
        std::memcpy(&word, f->data + y * f->stride + x * 4, 4);
        return word;
      };
      for (const auto& grid : *points)
        grids->push_back(grid ? std::optional(videoSamples(*grid, static_cast<int>(f->width),
                                                           static_cast<int>(f->height), pixel))
                              : std::nullopt);
      return true;
    };
    player->commandReading(Json::array({"screenshot-raw", "video", "bgra"}), read,
                           [grids, finish](std::optional<std::string> error, const Json& ok) {
                             if (error || ok != true) return finish(std::nullopt);
                             finish(std::move(*grids));
                           });
  });
}

}  // namespace tentacle::glass
