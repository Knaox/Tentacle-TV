// Lecteur : une instance libmpv pilotée en asynchrone, rappels sur le fil principal.
// Le rappel de réveil de mpv (fil quelconque) ne fait que poster UN drainage sur le fil
// principal ; le drainage lit les évènements sans bloquer (mpv_wait_event(…, 0)).

#include "player/player.h"

#include <mpv/client.h>

#include <atomic>
#include <cstdio>
#include <set>
#include <thread>
#include <unordered_map>

#include "platform/video_surface.h"
#include "player/mpv_node.h"
#include "player/sound_policy.h"

namespace tentacle {

using player_detail::OwnedNode;
using player_detail::toJson;

namespace {

mpv_format mpvFormat(PropFormat f) {
    switch (f) {
        case PropFormat::Flag: return MPV_FORMAT_FLAG;
        case PropFormat::Int64: return MPV_FORMAT_INT64;
        case PropFormat::Double: return MPV_FORMAT_DOUBLE;
        case PropFormat::String: return MPV_FORMAT_STRING;
        case PropFormat::Node: return MPV_FORMAT_NODE;
    }
    return MPV_FORMAT_NODE;
}

// Options que le lecteur tient lui-même (sortie vidéo) : jamais prises de l'appelant. Le son
// (`ao`, `mute`) suit `sound::forcedOptions`, posé après l'appelant.
const std::set<std::string> kReserved = {"vo", "wid", "gpu-context", "moltenvk-surface-size"};

std::string sizeString(PixelSize px) { return std::to_string(px.w) + "x" + std::to_string(px.h); }

}  // namespace

struct Player::Impl {
    mpv_handle* mpv = nullptr;
    PlayerOptions opts;
    std::atomic<bool> drainPosted{false};
    bool dead = false;
    uint64_t nextId = 1;
    std::unordered_map<uint64_t, PlayerDone> replies;  // commandes et écritures
    std::unordered_map<uint64_t, std::function<void(std::optional<Json>)>> reads;
    struct Observer { PropFormat format; std::function<void(const Json&)> cb; };
    std::unordered_map<uint64_t, Observer> observers;
    std::function<void(const Json&)> eventCb;
    VideoSurface* surface = nullptr;
    std::weak_ptr<Impl>* wakeCtx = nullptr;  // vit jusqu'à la libération de mpv

    static void wakeup(void* data) {  // fil quelconque
        auto* weak = static_cast<std::weak_ptr<Impl>*>(data);
        auto self = weak->lock();
        if (!self || self->drainPosted.exchange(true)) return;
        self->opts.post([w = *weak] {
            if (auto s = w.lock()) {
                s->drainPosted = false;
                s->drain();
            }
        });
    }

    void setAsync(const std::string& name, const Json& value, PlayerDone done = {}) {
        if (dead) return;
        const uint64_t id = nextId++;
        if (done) replies[id] = std::move(done);
        OwnedNode node(value);
        const int r = mpv_set_property_async(mpv, id, name.c_str(), MPV_FORMAT_NODE, node.get());
        if (r < 0) fail(id, r);
    }

    void fail(uint64_t id, int err) {  // erreur immédiate : livrée plus tard, comme une réponse
        auto it = replies.find(id);
        if (it == replies.end()) return;
        auto done = std::move(it->second);
        replies.erase(it);
        opts.post([done, msg = std::string(mpv_error_string(err))] { done(msg, nullptr); });
    }

    void drain() {
        while (!dead) {
            mpv_event* e = mpv_wait_event(mpv, 0);
            if (e->event_id == MPV_EVENT_NONE) return;
            const uint64_t id = e->reply_userdata;
            switch (e->event_id) {
                case MPV_EVENT_COMMAND_REPLY:
                case MPV_EVENT_SET_PROPERTY_REPLY: {
                    auto it = replies.find(id);
                    if (it == replies.end()) break;
                    auto done = std::move(it->second);
                    replies.erase(it);
                    Json result = nullptr;
                    if (e->event_id == MPV_EVENT_COMMAND_REPLY && e->error >= 0)
                        result = toJson(static_cast<mpv_event_command*>(e->data)->result);
                    if (e->error < 0) done(std::string(mpv_error_string(e->error)), nullptr);
                    else done(std::nullopt, result);
                    break;
                }
                case MPV_EVENT_GET_PROPERTY_REPLY: {
                    auto it = reads.find(id);
                    if (it == reads.end()) break;
                    auto done = std::move(it->second);
                    reads.erase(it);
                    auto* p = static_cast<mpv_event_property*>(e->data);
                    if (e->error < 0 || p->format == MPV_FORMAT_NONE) done(std::nullopt);
                    else done(toJson(p->format, p->data));
                    break;
                }
                case MPV_EVENT_PROPERTY_CHANGE: {
                    auto it = observers.find(id);
                    if (it == observers.end()) break;
                    auto* p = static_cast<mpv_event_property*>(e->data);
                    auto cb = it->second.cb;  // copie : le rappel peut se désabonner
                    cb(toJson(p->format, p->data));
                    break;
                }
                default:
                    if (eventCb) eventCb(player_detail::eventJson(e));
            }
        }
    }
};

Player::Player(std::shared_ptr<Impl> impl) : impl_(std::move(impl)) {}

std::unique_ptr<Player> Player::create(PlayerOptions options, std::string* error) {
    auto failWith = [&](const std::string& why) -> std::unique_ptr<Player> {
        if (error) *error = why;
        return nullptr;
    };
    if (!options.post) return failWith("PlayerOptions::post manquant");
    mpv_handle* mpv = mpv_create();
    if (!mpv) return failWith("mpv_create a échoué");

    auto set = [mpv](const std::string& k, const std::string& v) {
        const int r = mpv_set_option_string(mpv, k.c_str(), v.c_str());
        if (r < 0) fprintf(stderr, "[player] option %s=%s ignorée : %s\n", k.c_str(), v.c_str(),
                           mpv_error_string(r));
        return r >= 0;
    };
    // Défauts : mpv n'est qu'un moteur — aucune fenêtre, aucune touche, aucun terminal.
    const std::pair<const char*, const char*> defaults[] = {
        {"config", "no"}, {"terminal", "no"}, {"idle", "yes"},
        {"force-window", "no"}, {"input-default-bindings", "no"}, {"input-vo-keyboard", "no"},
        {"input-media-keys", "no"}, {"media-controls", "no"}, {"osd-level", "0"},
        // Sortie vidéo : aucune tant qu'aucune surface n'est attachée. HDR : le hint d'espace
        // cible doit être explicite (le contexte n'annonce pas d'espace cible : « auto » = SDR).
        {"vo", "null"}, {"gpu-api", "vulkan"}, {"target-colorspace-hint", "yes"},
        {"hwdec", "auto"},
        // Décodage matériel sur UN fil, comme mpv 0.40 (Electron) : depuis 0.41, 4 fils par défaut
        // (`dbda70a1`) — 4 contextes HEVC, leurs tampons et 2 images VideoToolbox de plus en vol,
        // +10 à 17 Mo pour rien (VideoToolbox décode de toute façon sur le GPU).
        {"hwdec-threads", "1"},
    };
    for (auto& [k, v] : defaults) set(k, v);
    if (options.audioOnly) {
        set("vid", "no");
        set("audio-display", "no");
    }
    std::string callerAo;
    for (auto& [k, v] : options.options) {
        if (kReserved.count(k)) continue;
        if (k == "ao") callerAo = v;
        else set(k, v);
    }
    for (auto& [k, v] : sound::forcedOptions(callerAo)) {
        // Sonde : sans son filtre à zéro, aucune sortie réelle.
        if (!set(k, v) && k == "af" && set("ao", "null"))
            fprintf(stderr, "[player] sonde : filtre refusé, sortie coupée (ao=null)\n");
    }
    if (!options.logFile.empty()) {
        set("log-file", options.logFile);
        set("msg-level", "all=" + options.logLevel);
    }

    auto impl = std::make_shared<Impl>();
    impl->mpv = mpv;
    impl->opts = std::move(options);
    impl->wakeCtx = new std::weak_ptr<Impl>(impl);
    mpv_set_wakeup_callback(mpv, &Impl::wakeup, impl->wakeCtx);
    if (const int r = mpv_initialize(mpv); r < 0) {
        mpv_set_wakeup_callback(mpv, nullptr, nullptr);
        mpv_terminate_destroy(mpv);
        delete impl->wakeCtx;
        return failWith(std::string("mpv_initialize : ") + mpv_error_string(r));
    }
    return std::unique_ptr<Player>(new Player(std::move(impl)));
}

Player::~Player() {
    if (impl_ && !impl_->dead) destroy({});
}

void Player::command(const Json& args, PlayerDone done) {
    Impl& s = *impl_;
    if (s.dead) return;
    const uint64_t id = s.nextId++;
    if (done) s.replies[id] = std::move(done);
    OwnedNode node(sound::guardMute(args));
    const int r = mpv_command_node_async(s.mpv, id, node.get());
    if (r < 0) s.fail(id, r);
}

void Player::setProperty(const std::string& name, const Json& value, PlayerDone done) {
    if (name == "mute" && sound::silent()) return impl_->setAsync(name, true, std::move(done));
    impl_->setAsync(name, value, std::move(done));
}

void Player::getProperty(const std::string& name, std::function<void(std::optional<Json>)> done) {
    Impl& s = *impl_;
    if (s.dead) return;
    const uint64_t id = s.nextId++;
    s.reads[id] = std::move(done);
    if (mpv_get_property_async(s.mpv, id, name.c_str(), MPV_FORMAT_NODE) < 0) {
        auto cb = std::move(s.reads[id]);
        s.reads.erase(id);
        s.opts.post([cb] { cb(std::nullopt); });
    }
}

uint64_t Player::observe(const std::string& name, PropFormat format,
                         std::function<void(const Json&)> cb) {
    Impl& s = *impl_;
    if (s.dead) return 0;
    const uint64_t id = s.nextId++;
    s.observers[id] = {format, std::move(cb)};
    mpv_observe_property(s.mpv, id, name.c_str(), mpvFormat(format));
    return id;
}

void Player::unobserve(uint64_t id) {
    if (impl_->dead || !impl_->observers.erase(id)) return;
    mpv_unobserve_property(impl_->mpv, id);
}

void Player::onEvent(std::function<void(const Json&)> cb) { impl_->eventCb = std::move(cb); }

bool Player::attachVideoSurface(VideoSurface& surface) {
    Impl& s = *impl_;
    if (s.dead || s.opts.audioOnly || s.surface) return false;
    s.surface = &surface;
    // Taille du swapchain : suivie à chaque changement (fenêtre, plein écran, écran).
    std::weak_ptr<Impl> weak = impl_;
    surface.onPixelSizeChanged([weak](PixelSize px) {
        if (auto i = weak.lock()) i->setAsync("moltenvk-surface-size", sizeString(px));
    });
    // Dans l'ordre (mpv traite les requêtes d'un client dans l'ordre) : la couche et sa
    // taille d'abord, la sortie vidéo en dernier — c'est elle qui fait naître le VO.
    s.setAsync("moltenvk-surface-size", sizeString(surface.pixelSize()));
    s.setAsync("gpu-context", surface.mpvGpuContext());
    s.setAsync("wid", surface.mpvWid());
    s.setAsync("vo", "gpu-next");
    return true;
}

void Player::detachVideoSurface() {
    Impl& s = *impl_;
    if (!s.surface) return;
    s.surface->onPixelSizeChanged(nullptr);
    s.surface = nullptr;
    s.setAsync("vo", "null");
    s.setAsync("wid", -1);
}

VideoSurface* Player::videoSurface() const { return impl_->surface; }

void Player::destroy(std::function<void()> done) {
    Impl& s = *impl_;
    auto post = s.opts.post;
    if (s.dead) {
        if (done) post(done);
        return;
    }
    if (s.surface) s.surface->onPixelSizeChanged(nullptr);
    s.dead = true;
    s.surface = nullptr;
    s.replies.clear();
    s.reads.clear();
    s.observers.clear();
    s.eventCb = nullptr;
    // Hors du fil principal : mpv_terminate_destroy attend la fin du cœur et de son VO.
    std::thread([mpv = s.mpv, wake = s.wakeCtx, post, done] {
        mpv_set_wakeup_callback(mpv, nullptr, nullptr);
        mpv_terminate_destroy(mpv);
        delete wake;
        if (done) post(done);
    }).detach();
    s.mpv = nullptr;
}

std::string playerLibraryInfo() {
    const unsigned long v = mpv_client_api_version();
    return "libmpv client API " + std::to_string(v >> 16) + "." + std::to_string(v & 0xffff);
}

}  // namespace tentacle
