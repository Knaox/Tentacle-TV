// Banc H1 (sans CEF) : fenêtre SDL3 + NOTRE VideoSurface macOS + libmpv (contexte moltenvk).
// La couche est hébergée comme le fera le compositeur du socle (bench_util.h › LayerHost).
// Lit les fichiers l'un après l'autre (N s chacun) et journalise, horodaté (même horloge que
// edr-probe) : évènements mpv, video-params, video-target-params, état de la couche, et la
// marge EDR lue DANS le processus (témoin croisé de la sonde externe). Son : ao=null + mute.
// Tout appel mpv depuis la boucle principale est asynchrone ; le rappel de réveil de mpv ne
// fait que poster un évènement SDL.
//
// hdr-bench [options] fichier…
//   --seconds N    durée de lecture de chaque fichier (défaut 8)
//   --baseline S   S secondes de fenêtre noire avant le 1er fichier (marge de référence)
//   --fullscreen   plein écran SDL3        --resize-at S  redimensionne S s après le départ
//   --overlay A    voile sRGB (alpha A) au-dessus de la vidéo, comme des contrôles web
//   --ontop        visible au-dessus de l'espace courant, sans activer l'app (mesure EDR)
//   --native       témoin : pas de VideoSurface, mpv ouvre SA fenêtre (contexte macvk)
//   --out F        journal dans F (lancement par `open`)   --mpv-log F  journal de mpv
// Expériences (variables d'environnement) : BENCH_SHOW_FIRST=1 (fenêtre montrée avant
// prepareWindowForVideo), TENTACLE_KEEP_WINDOW_COLORSPACE=1 (fenêtre laissée en sRGB).

#include <SDL3/SDL.h>
#include <mpv/client.h>

#include <atomic>
#include <cstdlib>
#include <memory>
#include <thread>
#include <vector>

#include "bench_util.h"
#include "mpv_json.h"
#include "platform/video_surface.h"

using namespace tentacle::bench;

namespace {

Uint32 gMpvEvent = 0;
bool gFileFailed = false;  // fichier illisible : passer au suivant au lieu d'attendre

void wakeup(void*) {
    SDL_Event ev{};
    ev.type = gMpvEvent;
    SDL_PushEvent(&ev);  // sûr depuis n'importe quel fil
}

std::string sizeOpt(tentacle::PixelSize s) { return std::to_string(s.w) + "x" + std::to_string(s.h); }

void setOpt(mpv_handle* mpv, const char* k, const std::string& v) {
    if (mpv_set_option_string(mpv, k, v.c_str()) < 0) fprintf(stderr, "option %s refusée\n", k);
}

void drainMpv(mpv_handle* mpv, Uint64& restartAt) {
    while (mpv_event* e = mpv_wait_event(mpv, 0)) {
        switch (e->event_id) {
            case MPV_EVENT_NONE: return;
            case MPV_EVENT_PROPERTY_CHANGE: {
                auto* p = (mpv_event_property*)e->data;
                if (p->format == MPV_FORMAT_NODE) emit(p->name, nodeToJson(*(mpv_node*)p->data));
                break;
            }
            case MPV_EVENT_PLAYBACK_RESTART:
                emit("event", "{\"name\":\"playback-restart\"}");
                if (!restartAt) restartAt = SDL_GetTicks();
                break;
            case MPV_EVENT_END_FILE: {
                auto* ef = (mpv_event_end_file*)e->data;
                if (ef->reason == MPV_END_FILE_REASON_ERROR) gFileFailed = true;
                emit("event", "{\"name\":\"end-file\",\"reason\":" + std::to_string(ef->reason) +
                                  ",\"error\":" + std::to_string(ef->error) + "}");
                break;
            }
            case MPV_EVENT_LOG_MESSAGE: break;
            default: emit("event", std::string("{\"name\":\"") + mpv_event_name(e->event_id) + "\"}");
        }
    }
}

}  // namespace

int main(int argc, char** argv) {
    double seconds = 8, baseline = 0, overlayAlpha = -1, resizeAt = -1;
    bool fullscreen = false, ontop = false, native = false;
    const char* mpvLog = nullptr;
    std::vector<std::string> files;
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        auto next = [&] { return i + 1 < argc ? argv[++i] : (char*)"0"; };
        if (a == "--seconds") seconds = atof(next());
        else if (a == "--baseline") baseline = atof(next());
        else if (a == "--fullscreen") fullscreen = true;
        else if (a == "--overlay") overlayAlpha = atof(next());
        else if (a == "--resize-at") resizeAt = atof(next());
        else if (a == "--mpv-log") mpvLog = next();
        else if (a == "--ontop") ontop = true;
        else if (a == "--native") native = true;
        else if (a == "--out") out() = fopen(next(), "w") ?: stdout;
        else files.push_back(a);
    }
    if (files.empty()) { fprintf(stderr, "usage : voir l'en-tête de hdr_bench.mm\n"); return 2; }

    if (!SDL_Init(SDL_INIT_VIDEO)) { fprintf(stderr, "SDL_Init: %s\n", SDL_GetError()); return 1; }
    gMpvEvent = SDL_RegisterEvents(1);
    // Chemin recommandé (à reprendre par le socle) : fenêtre créée cachée,
    // prepareWindowForVideo(), puis affichage.
    const bool showFirst = getenv("BENCH_SHOW_FIRST") != nullptr;
    SDL_WindowFlags flags = SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIGH_PIXEL_DENSITY;
    if (!showFirst) flags |= SDL_WINDOW_HIDDEN;
    SDL_Window* win = SDL_CreateWindow("Tentacle — banc HDR", 1280, 720, flags);
    if (!win) { fprintf(stderr, "SDL_CreateWindow: %s\n", SDL_GetError()); return 1; }
    NSWindow* nsWin = (__bridge NSWindow*)SDL_GetPointerProperty(
        SDL_GetWindowProperties(win), SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
    if (!showFirst) tentacle::prepareWindowForVideo((__bridge void*)nsWin);
    LayerHost host(nsWin);
    if (overlayAlpha >= 0) host.addVeil(overlayAlpha);
    if (!native) SDL_ShowWindow(win);
    if (ontop && !native) makeVisibleForMeasure(nsWin);
    if (fullscreen) SDL_SetWindowFullscreen(win, true);
    emit("start", "{}");

    mpv_handle* mpv = mpv_create();
    if (!mpv) { fprintf(stderr, "mpv_create a échoué\n"); return 1; }
    std::unique_ptr<tentacle::VideoSurface> surface;
    CAMetalLayer* layer = nil;
    auto relayout = [&] {
        const CGSize sz = host.size();
        if (surface) surface->setFrame({0, 0, sz.width, sz.height});
        host.layoutVeil();
    };
    if (native) {
        setOpt(mpv, "gpu-context", "macvk");
        setOpt(mpv, "geometry", "1280x720");
    } else {
        // La surface naît ICI, juste avant le premier loadfile.
        surface = tentacle::createVideoSurface((__bridge void*)nsWin);
        if (!surface) { fprintf(stderr, "surface indisponible\n"); return 1; }
        layer = (__bridge CAMetalLayer*)surface->nativeLayer();
        host.addVideo(layer);
        relayout();
        logLayer(layer, "born");
        setOpt(mpv, "gpu-context", surface->mpvGpuContext());
        setOpt(mpv, "wid", std::to_string(surface->mpvWid()));
        setOpt(mpv, "moltenvk-surface-size", sizeOpt(surface->pixelSize()));
    }
    const std::pair<const char*, const char*> opts[] = {
        {"vo", "gpu-next"}, {"gpu-api", "vulkan"}, {"target-colorspace-hint", "yes"},
        {"hwdec", "auto"}, {"ao", "null"}, {"mute", "yes"}, {"idle", "yes"},
        {"force-window", "no"}, {"keep-open", "no"}, {"media-controls", "no"},
        {"input-media-keys", "no"}, {"input-default-bindings", "no"}, {"terminal", "no"},
    };
    for (auto& [k, v] : opts) setOpt(mpv, k, v);
    // Expérience : sortie en sRGB linéaire étendu (swapchain RGBA16F, comme la recette EDR
    // d'Apple et l'ère 1 de jellium) au lieu de PQ.
    if (const char* hw = getenv("BENCH_HWDEC")) setOpt(mpv, "hwdec", hw);  // expérience : décodage
    if (getenv("BENCH_LINEAR_TARGET")) { setOpt(mpv, "target-trc", "linear"); setOpt(mpv, "target-prim", "bt.709"); }
    if (mpvLog) { setOpt(mpv, "log-file", mpvLog); setOpt(mpv, "msg-level", "all=v"); }
    mpv_observe_property(mpv, 1, "video-params", MPV_FORMAT_NODE);
    mpv_observe_property(mpv, 2, "video-target-params", MPV_FORMAT_NODE);
    mpv_set_wakeup_callback(mpv, wakeup, nullptr);
    if (mpv_initialize(mpv) < 0) { fprintf(stderr, "mpv_initialize a échoué\n"); return 1; }
    if (surface) surface->onPixelSizeChanged([mpv](tentacle::PixelSize px) {
        const std::string v = sizeOpt(px);
        const char* args[] = {"set", "moltenvk-surface-size", v.c_str(), nullptr};
        mpv_command_async(mpv, 0, args);
        emit("resize", "{\"px\":\"" + v + "\"}");
    });

    size_t current = 0;
    bool loaded = false, sampled = false, resized = false, quit = false;
    Uint64 restartAt = 0;
    const Uint64 startedAt = SDL_GetTicks();
    Uint64 lastEdr = 0;
    while (!quit) {
        SDL_Event ev;
        if (SDL_WaitEventTimeout(&ev, 50)) {
            do {
                if (ev.type == SDL_EVENT_QUIT) quit = true;
                else if (ev.type == SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED ||
                         ev.type == SDL_EVENT_WINDOW_RESIZED) relayout();
                else if (ev.type == gMpvEvent) drainMpv(mpv, restartAt);
            } while (SDL_PollEvent(&ev));
        }
        const Uint64 now = SDL_GetTicks();
        if (now - lastEdr >= 250) {  // marge EDR vue de l'intérieur (app qui pompe AppKit)
            char b[64];
            snprintf(b, sizeof b, "{\"edr\":%.3f}", nsWin.screen.maximumExtendedDynamicRangeColorComponentValue);
            emit("edr-inproc", b);
            lastEdr = now;
        }
        if (!loaded && now - startedAt >= baseline * 1000) {
            const char* args[] = {"loadfile", files[current].c_str(), nullptr};
            mpv_command_async(mpv, 0, args);
            emit("loadfile", "{\"file\":\"" + files[current] + "\"}");
            loaded = true;
        }
        if (native && !layer) {  // la fenêtre de mpv apparaît au premier VO
            for (NSWindow* w in NSApp.windows)
                if (w != nsWin && w.visible && (layer = findMetalLayer(w.contentView.layer))) {
                    if (ontop) makeVisibleForMeasure(w);
                    logLayer(layer, "born");
                }
        }
        if (gFileFailed) {
            gFileFailed = false;
            loaded = false;
            if (++current >= files.size()) quit = true;
            continue;
        }
        if (!restartAt) continue;
        const double t = (now - restartAt) / 1000.0;
        if (!sampled && t > 2.0) {
            logLayer(layer, "playing+2s");
            logWindow(layer.delegate ? ((NSView*)layer.delegate).window : nsWin);
            dumpLayer(layer);
            SEL sample = NSSelectorFromString(@"tentacleSampleAtX:y:");
            if ([layer respondsToSelector:sample]) {
                const int W = layer.drawableSize.width, H = layer.drawableSize.height;
                using Fn = NSString* (*)(id, SEL, int, int);
                auto fn = (Fn)[layer methodForSelector:sample];
                NSString* d = [NSString stringWithFormat:
                    @"{\"centre_1000\":\"%@\",\"carre_4000\":\"%@\",\"bande_203\":\"%@\",\"fond_5\":\"%@\"}",
                    fn(layer, sample, W * 1100 / 1920, H / 6), fn(layer, sample, W / 2, H / 2),
                    fn(layer, sample, W / 8, H / 2), fn(layer, sample, W * 1800 / 1920, H / 2)];
                emit("pixels", d.UTF8String);
                NSString* st = [layer performSelector:NSSelectorFromString(@"tentaclePresentStats")];
                emit("present", [NSString stringWithFormat:@"{\"stats\":\"%@\"}", st].UTF8String);
            }
            sampled = true;
        }
        if (resizeAt >= 0 && !resized && t > resizeAt) {
            int w, h;
            SDL_GetWindowSize(win, &w, &h);
            SDL_SetWindowSize(win, w == 1280 ? 960 : 1280, h == 720 ? 540 : 720);
            resized = true;
        }
        if (t >= seconds) {
            logLayer(layer, "end");
            restartAt = 0; sampled = resized = loaded = false;
            if (++current >= files.size()) quit = true;
        }
    }
    // Avant la surface (mpv relâche la couche). Hors du fil principal : en --native, le VO
    // macvk fait DispatchQueue.main.sync à sa fermeture (interblocage sinon, cf. jellium).
    std::atomic<bool> done{false};
    std::thread closer([&] { mpv_terminate_destroy(mpv); done = true; });
    while (!done) [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode
                                           beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.01]];
    closer.join();
    surface.reset();
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}
