// Octave — libmpv direct (voir l'en-tête).
//
// La file d'évènements est vidée sur le fil principal, réveillée par
// `mpv_set_wakeup_callback` (appelé depuis un fil de mpv : il ne fait que
// poster). Jamais d'appel synchrone : `mpv_command_node_async`,
// `mpv_get_property_async`, `mpv_wait_event(0)`. Arrêt : `quit` asynchrone
// puis `mpv_destroy` à `MPV_EVENT_SHUTDOWN` (mesuré par Tentacle : un
// `mpv_terminate_destroy` d'un bloc tenait parfois le fil 1,5 s).
#include "music/mpv_audio_backend.h"

#include <clocale>
#include <cstdio>
#include <cstdlib>
#include <map>

#include <mpv/client.h>

namespace tentacle::music {
namespace {

nlohmann::json fromNode(const mpv_node* n) {
  switch (n->format) {
    case MPV_FORMAT_STRING: return n->u.string ? nlohmann::json(n->u.string) : nlohmann::json();
    case MPV_FORMAT_FLAG: return n->u.flag != 0;
    case MPV_FORMAT_INT64: return n->u.int64;
    case MPV_FORMAT_DOUBLE: return n->u.double_;
    case MPV_FORMAT_NODE_ARRAY: {
      auto a = nlohmann::json::array();
      for (int i = 0; i < n->u.list->num; i++) a.push_back(fromNode(&n->u.list->values[i]));
      return a;
    }
    case MPV_FORMAT_NODE_MAP: {
      auto o = nlohmann::json::object();
      for (int i = 0; i < n->u.list->num; i++) o[n->u.list->keys[i]] = fromNode(&n->u.list->values[i]);
      return o;
    }
    default: return nullptr;
  }
}

mpv_format formatOf(PropFormat f) {
  switch (f) {
    case PropFormat::Flag: return MPV_FORMAT_FLAG;
    case PropFormat::Int64: return MPV_FORMAT_INT64;
    case PropFormat::Double: return MPV_FORMAT_DOUBLE;
    case PropFormat::String: return MPV_FORMAT_STRING;
  }
  return MPV_FORMAT_NONE;
}

PropValue valueOf(const mpv_event_property* p) {
  if (!p->data) return std::monostate{};
  switch (p->format) {
    case MPV_FORMAT_FLAG: return *static_cast<int*>(p->data) != 0;
    case MPV_FORMAT_INT64: return *static_cast<int64_t*>(p->data);
    case MPV_FORMAT_DOUBLE: return *static_cast<double*>(p->data);
    case MPV_FORMAT_STRING: {
      const char* s = *static_cast<char**>(p->data);
      return s ? PropValue(std::string(s)) : PropValue(std::monostate{});
    }
    default: return std::monostate{};
  }
}

// Le niveau du journal de mpv relayé sur stderr : `TENTACLE_MUSIC_MPV_LOG`
// (`warn` par défaut ; `v` montre l'ouverture CoreAudio — preuve sans son).
const char* logLevel() {
  const char* v = std::getenv("TENTACLE_MUSIC_MPV_LOG");
  return v && *v ? v : "warn";
}

}  // namespace

struct MpvAudioBackend::Impl : std::enable_shared_from_this<Impl> {
  explicit Impl(Scheduler& s) : scheduler(s) {}

  Scheduler& scheduler;
  mpv_handle* ctx = nullptr;
  BackendEvents events;
  uint64_t nextReply = 1'000'000;  // au-dessus des identifiants de propriétés observées
  std::map<uint64_t, Done> commands;
  std::map<uint64_t, std::function<void(nlohmann::json)>> reads;
  std::function<void()> onShutdown;
  // Le réveil vit jusqu'à `mpv_destroy` : il ne garde qu'un pointeur faible.
  struct Waker {
    Scheduler* scheduler;
    std::weak_ptr<Impl> impl;
  };
  Waker* waker = nullptr;

  static void wakeup(void* data) {
    auto* w = static_cast<Waker*>(data);
    w->scheduler->post([weak = w->impl] {
      if (auto self = weak.lock()) self->drain();
    });
  }

  void drain() {
    while (ctx) {
      mpv_event* ev = mpv_wait_event(ctx, 0);
      if (ev->event_id == MPV_EVENT_NONE) return;
      if (ev->event_id == MPV_EVENT_SHUTDOWN) return release();
      dispatch(ev);
    }
  }

  void dispatch(mpv_event* ev) {
    switch (ev->event_id) {
      case MPV_EVENT_COMMAND_REPLY: {
        auto it = commands.find(ev->reply_userdata);
        if (it == commands.end()) return;
        Done done = std::move(it->second);
        commands.erase(it);
        auto* cmd = static_cast<mpv_event_command*>(ev->data);
        std::optional<std::string> err;
        if (ev->error < 0) err = mpv_error_string(ev->error);
        if (done) done(err, cmd ? fromNode(&cmd->result) : nlohmann::json());
        return;
      }
      case MPV_EVENT_GET_PROPERTY_REPLY: {
        auto it = reads.find(ev->reply_userdata);
        if (it == reads.end()) return;
        auto read = std::move(it->second);
        reads.erase(it);
        auto* p = static_cast<mpv_event_property*>(ev->data);
        bool ok = ev->error >= 0 && p && p->format == MPV_FORMAT_NODE && p->data;
        read(ok ? fromNode(static_cast<mpv_node*>(p->data)) : nlohmann::json());
        return;
      }
      case MPV_EVENT_PROPERTY_CHANGE: {
        auto* p = static_cast<mpv_event_property*>(ev->data);
        if (events.property) events.property(p->name, valueOf(p));
        return;
      }
      case MPV_EVENT_START_FILE: {
        auto* s = static_cast<mpv_event_start_file*>(ev->data);
        if (events.startFile) events.startFile(s->playlist_entry_id);
        return;
      }
      case MPV_EVENT_END_FILE: {
        auto* e = static_cast<mpv_event_end_file*>(ev->data);
        if (events.endFile) events.endFile(e->playlist_entry_id, e->reason, e->error);
        return;
      }
      case MPV_EVENT_PLAYBACK_RESTART:
        if (events.playbackRestart) events.playbackRestart();
        return;
      case MPV_EVENT_LOG_MESSAGE: {
        auto* m = static_cast<mpv_event_log_message*>(ev->data);
        std::fprintf(stderr, "[music/mpv] %s: %s", m->prefix, m->text);
        return;
      }
      default: return;
    }
  }

  void release() {
    mpv_handle* h = ctx;
    ctx = nullptr;
    if (h) mpv_destroy(h);
    delete waker;  // plus aucun réveil possible après `mpv_destroy`
    waker = nullptr;
    for (auto& [id, done] : commands)
      if (done) done(std::string("mpv audio arrete"), nullptr);
    commands.clear();
    for (auto& [id, read] : reads) read(nullptr);
    reads.clear();
    if (auto cb = std::move(onShutdown)) cb();
  }
};

MpvAudioBackend::MpvAudioBackend(Scheduler& scheduler) : impl_(std::make_shared<Impl>(scheduler)) {}

MpvAudioBackend::~MpvAudioBackend() {
  // Détruit sans attendre (fin du processus) : le chemin normal est `destroy`.
  if (impl_->ctx) {
    mpv_set_wakeup_callback(impl_->ctx, nullptr, nullptr);
    mpv_terminate_destroy(impl_->ctx);
    impl_->ctx = nullptr;
    delete impl_->waker;
    impl_->waker = nullptr;
  }
}

std::optional<std::string> MpvAudioBackend::start(const Options& options, const Observed& observed,
                                                  BackendEvents events) {
  if (impl_->ctx) return std::nullopt;
  std::setlocale(LC_NUMERIC, "C");  // exigé par libmpv
  mpv_handle* h = mpv_create();
  if (!h) return std::string("mpv_create a echoue");
  for (const auto& [k, v] : options) {
    int code = mpv_set_option_string(h, k.c_str(), v.c_str());
    if (code < 0) std::fprintf(stderr, "[music] option refusee (%s) : %s=%s\n", mpv_error_string(code), k.c_str(), v.c_str());
  }
  if (int code = mpv_initialize(h); code < 0) {
    mpv_terminate_destroy(h);
    return std::string("mpv_initialize : ") + mpv_error_string(code);
  }
  impl_->ctx = h;
  impl_->events = std::move(events);
  mpv_request_log_messages(h, logLevel());
  uint64_t id = 1;
  for (const auto& [name, format] : observed) mpv_observe_property(h, id++, name.c_str(), formatOf(format));
  impl_->waker = new Impl::Waker{&impl_->scheduler, impl_};
  mpv_set_wakeup_callback(h, &Impl::wakeup, impl_->waker);
  return std::nullopt;
}

bool MpvAudioBackend::running() const { return impl_->ctx != nullptr; }

void MpvAudioBackend::command(std::vector<std::string> args, Done done) {
  if (!impl_->ctx) {
    if (done) done(std::string("mpv audio arrete"), nullptr);
    return;
  }
  std::vector<const char*> argv;
  for (const auto& a : args) argv.push_back(a.c_str());
  argv.push_back(nullptr);
  uint64_t id = impl_->nextReply++;
  impl_->commands[id] = std::move(done);
  // `mpv_command_async` copie ses arguments : `args` peut mourir ici. Le
  // résultat (`playlist_entry_id` de `loadfile`) part avec la réponse.
  mpv_node list[64];
  mpv_node_list nl{};
  nl.num = static_cast<int>(args.size());
  nl.values = list;
  for (size_t i = 0; i < args.size() && i < 64; i++) {
    list[i].format = MPV_FORMAT_STRING;
    list[i].u.string = const_cast<char*>(argv[i]);
  }
  mpv_node root{};
  root.format = MPV_FORMAT_NODE_ARRAY;
  root.u.list = &nl;
  if (int code = mpv_command_node_async(impl_->ctx, id, &root); code < 0) {
    auto d = std::move(impl_->commands[id]);
    impl_->commands.erase(id);
    if (d) d(std::string(mpv_error_string(code)), nullptr);
  }
}

void MpvAudioBackend::getProperty(const std::string& name, std::function<void(nlohmann::json)> done) {
  if (!impl_->ctx) return done(nullptr);
  uint64_t id = impl_->nextReply++;
  impl_->reads[id] = std::move(done);
  if (mpv_get_property_async(impl_->ctx, id, name.c_str(), MPV_FORMAT_NODE) < 0) {
    auto d = std::move(impl_->reads[id]);
    impl_->reads.erase(id);
    d(nullptr);
  }
}

void MpvAudioBackend::destroy(std::function<void()> done) {
  if (!impl_->ctx) {
    if (done) done();
    return;
  }
  impl_->onShutdown = std::move(done);
  const char* quit[] = {"quit", nullptr};
  mpv_command_async(impl_->ctx, 0, quit);
  // Filet : un cœur muet 3 s est libéré de force.
  impl_->scheduler.postDelayed(3000, [weak = std::weak_ptr<Impl>(impl_)] {
    auto self = weak.lock();
    if (self && self->ctx && self->onShutdown) {
      std::fprintf(stderr, "[music] arret force du coeur mpv (3 s sans SHUTDOWN)\n");
      self->release();
    }
  });
}

}  // namespace tentacle::music
