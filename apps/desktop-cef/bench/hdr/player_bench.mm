// Banc H2 (sans CEF) : l'API Player + VideoSurface dans une fenêtre SDL3, couche hébergée
// comme par le compositeur du socle, voile « page » au-dessus. Scénario scripté, chaque
// vérification imprimée « CHECK <nom> OK|ÉCHEC <détail> » ; marge EDR lue dans le processus.
//
// player-bench [--ontop] [--out F] <hdr10.mkv> <sdr.mkv> <musique.flac>

#include <SDL3/SDL.h>

#include <cstdlib>
#include <deque>
#include <functional>
#include <memory>

#include "bench_util.h"
#include "platform/video_surface.h"
#include "player/player.h"

using namespace tentacle;
using namespace tentacle::bench;

namespace {

Uint32 gTask = 0;
int gFailures = 0;

void post(std::function<void()> fn) {  // vers le fil principal, depuis n'importe quel fil
    SDL_Event ev{};
    ev.type = gTask;
    ev.user.data1 = new std::function<void()>(std::move(fn));
    SDL_PushEvent(&ev);
}

void check(const std::string& name, bool ok, const std::string& detail = "") {
    if (!ok) gFailures++;
    emit("CHECK", "{\"name\":\"" + name + "\",\"ok\":" + (ok ? "true" : "false") +
                      ",\"detail\":" + Json(detail).dump() + "}");
}

int countMetalLayers(CALayer* l) {
    int n = [l isKindOfClass:[CAMetalLayer class]] ? 1 : 0;
    for (CALayer* c in l.sublayers) n += countMetalLayers(c);
    return n;
}

struct Step { double at; std::string name; std::function<void()> run; };

}  // namespace

int main(int argc, char** argv) {
    setenv("TENTACLE_MUTE", "1", 1);  // banc : jamais de son (player/sound_policy.h)
    bool ontop = false;
    std::vector<std::string> files;
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        if (a == "--ontop") ontop = true;
        else if (a == "--out" && i + 1 < argc) out() = fopen(argv[++i], "w") ?: stdout;
        else files.push_back(a);
    }
    if (files.size() < 3) { fprintf(stderr, "usage: player-bench [--ontop] hdr sdr musique\n"); return 2; }
    const std::string hdr = files[0], sdr = files[1], music = files[2];

    SDL_Init(SDL_INIT_VIDEO);
    gTask = SDL_RegisterEvents(1);
    SDL_Window* win = SDL_CreateWindow("Tentacle — banc Player", 1280, 720,
                                       SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIGH_PIXEL_DENSITY | SDL_WINDOW_HIDDEN);
    NSWindow* nsWin = (__bridge NSWindow*)SDL_GetPointerProperty(
        SDL_GetWindowProperties(win), SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
    prepareWindowForVideo((__bridge void*)nsWin);  // avant la 1re mise à l'écran
    LayerHost host(nsWin);
    host.addVeil(0.6);  // « contrôles web » au-dessus de la vidéo
    SDL_ShowWindow(win);
    if (ontop) makeVisibleForMeasure(nsWin);
    host.layoutVeil();

    std::unique_ptr<VideoSurface> surface;
    auto relayout = [&] {
        const CGSize sz = host.size();
        if (surface) surface->setFrame({0, 0, sz.width, sz.height});
        host.layoutVeil();
    };
    auto layers = [&] { return countMetalLayers(host.root); };

    // --- Mode musique : instance audio seule, jamais de couche ------------------------------
    std::unique_ptr<Player> musicPlayer, player;
    std::deque<Step> steps;
    auto prop = [&](Player* p, const std::string& name, std::function<void(std::optional<Json>)> cb) {
        p->getProperty(name, std::move(cb));
    };
    steps.push_back({0.0, "musique", [&] {
        musicPlayer = Player::create({.post = post, .audioOnly = true});
        check("musique.create", musicPlayer != nullptr);
        musicPlayer->command(Json::array({"loadfile", music}), [&](auto err, const Json& r) {
            check("musique.loadfile", !err, err.value_or(r.dump()));
        });
    }});
    steps.push_back({2.5, "musique.état", [&] {
        check("musique.aucune-couche", layers() == 0, std::to_string(layers()));
        check("musique.attach-refusé", !musicPlayer->attachVideoSurface(*createVideoSurface((__bridge void*)nsWin)));
        prop(musicPlayer.get(), "current-vo", [](std::optional<Json> v) { check("musique.sans-vo", !v || v->is_null(), v ? v->dump() : "absent"); });
        prop(musicPlayer.get(), "time-pos", [](std::optional<Json> v) { check("musique.avance", v && v->get<double>() > 0.5, v ? v->dump() : "absent"); });
        prop(musicPlayer.get(), "mute", [](std::optional<Json> v) { check("musique.muet", v && *v == true, v ? v->dump() : "absent"); });
        prop(musicPlayer.get(), "audio-params", [](std::optional<Json> v) { check("musique.audio-params", v && v->is_object(), v ? v->dump() : "absent"); });
    }});
    // destroy() annule les réponses en attente : on attend donc les lectures ci-dessus.
    steps.push_back({3.2, "musique.fin", [&] { musicPlayer->destroy([] { check("musique.destroy", true); }); }});
    // --- Vidéo sans surface : aucune sortie, aucune fenêtre de mpv ---------------------------
    steps.push_back({3.5, "vidéo.sans-surface", [&] {
        player = Player::create({.post = post, .logFile = getenv("PLAYER_BENCH_MPV_LOG") ?: ""});
        player->onEvent([](const Json& ev) { if (ev["event"] != "log-message") emit("event", ev.dump()); });
        player->observe("video-target-params", PropFormat::Node, [](const Json& v) {
            if (v.is_object()) emit("video-target-params", v.dump());
        });
        player->command(Json::array({"loadfile", hdr}));
    }});
    steps.push_back({5.0, "vidéo.sans-surface.état", [&] {
        prop(player.get(), "current-vo", [](std::optional<Json> v) { check("sans-surface.vo-null", v && *v == "null", v ? v->dump() : "absent"); });
        check("sans-surface.aucune-couche", layers() == 0, std::to_string(layers()));
        check("sans-surface.aucune-fenêtre-mpv", NSApp.windows.count == 1, std::to_string(NSApp.windows.count));
    }});
    // --- Attachement à chaud (bascule musique/accueil → vidéo) -------------------------------
    steps.push_back({5.5, "attach", [&] {
        surface = createVideoSurface((__bridge void*)nsWin);
        host.addVideo((__bridge CALayer*)surface->nativeLayer());
        relayout();
        check("attach", player->attachVideoSurface(*surface));
    }});
    auto expectLayer = [&](const std::string& tag, bool pq) {
        auto c = surface->colorState();
        check(tag + ".couche", pq ? c.colorspace == "kCGColorSpaceITUR_2100_PQ" && c.wantsEdr
                                  : c.colorspace == "kCGColorSpaceITUR_709" && !c.wantsEdr,
              c.colorspace + " edr=" + std::to_string(c.wantsEdr));
        prop(player.get(), "video-target-params/gamma", [tag, pq](std::optional<Json> v) {
            check(tag + ".cible", v && *v == (pq ? "pq" : "bt.1886"), v ? v->dump() : "absent");
        });
        prop(player.get(), "current-vo", [tag](std::optional<Json> v) { check(tag + ".vo", v && *v == "gpu-next", v ? v->dump() : "absent"); });
        logWindow(nsWin);
    };
    steps.push_back({9.0, "hdr", [&] { expectLayer("hdr10", true); }});
    steps.push_back({9.5, "sdr", [&] { player->command(Json::array({"loadfile", sdr})); }});
    steps.push_back({13.0, "sdr.état", [&] { expectLayer("sdr", false); }});
    steps.push_back({13.5, "hdr2", [&] { player->command(Json::array({"loadfile", hdr})); }});
    steps.push_back({17.0, "hdr2.état", [&] { expectLayer("hdr10-retour", true); }});
    // --- Redimensionnement : la taille du swapchain suit -------------------------------------
    steps.push_back({17.5, "resize", [&] { SDL_SetWindowSize(win, 960, 540); }});
    steps.push_back({20.0, "resize.état", [&] {
        const PixelSize px = surface->pixelSize();
        prop(player.get(), "video-target-params", [px](std::optional<Json> v) {
            check("resize.swapchain", v && (*v)["w"] == px.w && (*v)["h"] == px.h,
                  (v ? v->dump().substr(0, 80) : "absent") + " surface=" + std::to_string(px.w) + "x" + std::to_string(px.h));
        });
        expectLayer("resize", true);
    }});
    // --- Détachement, destruction de la surface, ré-attachement d'une nouvelle --------------
    steps.push_back({21.0, "detach", [&] {
        player->detachVideoSurface();
        surface.reset();  // retire la couche de l'arbre ; mpv garde sa référence jusqu'à son VO
    }});
    steps.push_back({22.5, "detach.état", [&] {
        prop(player.get(), "current-vo", [](std::optional<Json> v) { check("detach.vo-null", v && *v == "null", v ? v->dump() : "absent"); });
        check("detach.aucune-couche", layers() == 0, std::to_string(layers()));
        prop(player.get(), "time-pos", [](std::optional<Json> v) { check("detach.lecture-continue", v && v->get<double>() > 0, v ? v->dump() : "absent"); });
    }});
    steps.push_back({23.0, "reattach", [&] {
        surface = createVideoSurface((__bridge void*)nsWin);
        host.addVideo((__bridge CALayer*)surface->nativeLayer());
        relayout();
        check("reattach", player->attachVideoSurface(*surface));
    }});
    steps.push_back({26.5, "reattach.état", [&] { expectLayer("reattach", true); }});
    steps.push_back({27.0, "destroy", [&] {
        player->destroy([&] { check("destroy", true); post([] { SDL_Event q{}; q.type = SDL_EVENT_QUIT; SDL_PushEvent(&q); }); });
    }});

    const Uint64 t0 = SDL_GetTicks();
    Uint64 lastEdr = 0;
    for (bool quit = false; !quit;) {
        SDL_Event ev;
        if (SDL_WaitEventTimeout(&ev, 20)) do {
            if (ev.type == SDL_EVENT_QUIT) quit = true;
            else if (ev.type == SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED || ev.type == SDL_EVENT_WINDOW_RESIZED) relayout();
            else if (ev.type == gTask) {
                auto* fn = static_cast<std::function<void()>*>(ev.user.data1);
                (*fn)();
                delete fn;
            }
        } while (SDL_PollEvent(&ev));
        const double t = (SDL_GetTicks() - t0) / 1000.0;
        while (!steps.empty() && t >= steps.front().at) {
            emit("step", "{\"name\":\"" + steps.front().name + "\"}");
            steps.front().run();
            steps.pop_front();
        }
        if (SDL_GetTicks() - lastEdr >= 250) {
            emit("edr-inproc", "{\"edr\":" + std::to_string(nsWin.screen.maximumExtendedDynamicRangeColorComponentValue) + "}");
            lastEdr = SDL_GetTicks();
        }
        if (t > 40) { check("délai", false, "scénario non terminé"); quit = true; }
    }
    emit("RESULT", "{\"failures\":" + std::to_string(gFailures) + "}");
    surface.reset();
    SDL_DestroyWindow(win);
    SDL_Quit();
    return gFailures ? 1 : 0;
}
