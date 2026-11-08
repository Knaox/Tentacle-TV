// edr-calib — témoin d'étalonnage : le système accorde-t-il l'EDR EN CE MOMENT ?
//
// Ouvre une petite fenêtre (flottante, visible au-dessus de l'espace courant, sans activer
// l'app) dont une CAMetalLayer en RGBA16F / sRGB linéaire étendu, wantsEDR, est remplie d'un
// blanc de valeur V (> 1 = au-delà du blanc SDR). C'est la recette EDR la plus simple d'Apple :
// si la marge reste à 1,00 avec ce témoin, le blocage vient de l'écran ou du système (réglage
// d'affichage, luminosité, fenêtre masquée), pas de mpv ni de notre surface.
// Lit aussi la marge dans le processus, toutes les 250 ms (stdout, même format que edr-probe).
//
// Usage : edr-calib [--value V] [--seconds S] [--pq] [--meta] [--format bgr10a2|rgba16f]
//   --pq     : couche en ITUR_2100_PQ (comme MoltenVK pour une sortie HDR10) ; V = code PQ
//              (0,75 ≈ 1 000 nits) au lieu d'une valeur linéaire
//   --meta   : CAEDRMetadata HDR10 (1 000 nits) sur la couche, comme VK_EXT_hdr_metadata
//   --meta-scale S : opticalOutputScale de ces métadonnées (défaut 100 ; MoltenVK 1.4.2 met 1)
//   --no-edr : ne pas demander wantsExtendedDynamicRangeContent
//   --opaque : couche opaque (comme la force MoltenVK/mpv : « direct-to-display » possible)
//   --fb-any : framebufferOnly = NO (comme MoltenVK)
//   --sdl-window [--reset-colorspace] : la couche dans une fenêtre SDL3 (sous-couche d'un hôte),
//              avec ou sans retour à l'espace de couleur par défaut avant affichage
//   --sublayer : sous-couche d'une vue hôte (comme le compositeur) au lieu de la couche de vue
//   --with-libmpv : une instance libmpv initialisée (vo=null) dans le processus
//   --sdl-init : SDL_Init(SDL_INIT_VIDEO) d'abord, comme le banc et l'app (SDL3 coupe-t-il l'EDR ?)
//   --mpv-pattern : (avec --pq --format bgr10a2) le motif EXACT relevé dans le drawable de mpv
//              (codes 10 bits : fond 201, bande 509, centre 660, carré 4 000 nits → 768)

#import <AppKit/AppKit.h>
#import <Metal/Metal.h>
#import <QuartzCore/QuartzCore.h>
#include <SDL3/SDL.h>
#include <mpv/client.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sys/time.h>
#include <vector>

static void stamp() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    struct tm tmv;
    localtime_r(&tv.tv_sec, &tmv);
    char buf[32];
    strftime(buf, sizeof buf, "%Y-%m-%dT%H:%M:%S", &tmv);
    printf("%s.%03d", buf, (int)(tv.tv_usec / 1000));
}

int main(int argc, char** argv) {
    @autoreleasepool {
        double value = 4.0, seconds = 6.0;
        double metaScale = 100;
        bool pq = false, meta = false, edr = true, bgr10 = false, opaque = false, fbAny = false;
        bool mpvPattern = false, sdlInit = false, sdlWindow = false, sublayer = false, resetCs = false, withMpv = false;
        for (int i = 1; i < argc; i++) {
            if (!strcmp(argv[i], "--value") && i + 1 < argc) value = atof(argv[++i]);
            else if (!strcmp(argv[i], "--seconds") && i + 1 < argc) seconds = atof(argv[++i]);
            else if (!strcmp(argv[i], "--pq")) pq = true;
            else if (!strcmp(argv[i], "--meta")) meta = true;
            else if (!strcmp(argv[i], "--meta-scale") && i + 1 < argc) { meta = true; metaScale = atof(argv[++i]); }
            else if (!strcmp(argv[i], "--no-edr")) edr = false;
            else if (!strcmp(argv[i], "--opaque")) opaque = true;
            else if (!strcmp(argv[i], "--mpv-pattern")) mpvPattern = true;
            else if (!strcmp(argv[i], "--sdl-init")) sdlInit = true;
            else if (!strcmp(argv[i], "--sdl-window")) sdlWindow = sdlInit = sublayer = true;
            else if (!strcmp(argv[i], "--sublayer")) sublayer = true;
            else if (!strcmp(argv[i], "--reset-colorspace")) resetCs = true;
            else if (!strcmp(argv[i], "--with-libmpv")) withMpv = true;
            else if (!strcmp(argv[i], "--fb-any")) fbAny = true;
            else if (!strcmp(argv[i], "--format") && i + 1 < argc) bgr10 = !strcmp(argv[++i], "bgr10a2");
        }
        if (sdlInit && !SDL_Init(SDL_INIT_VIDEO)) fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
        [NSApp finishLaunching];

        NSWindow* w = nil;
        SDL_Window* sw = nullptr;
        if (sdlWindow) {  // la fenêtre de SDL3, comme le banc et l'app
            sw = SDL_CreateWindow("edr-calib", 480, 270, SDL_WINDOW_HIGH_PIXEL_DENSITY | SDL_WINDOW_HIDDEN);
            w = (__bridge NSWindow*)SDL_GetPointerProperty(SDL_GetWindowProperties(sw),
                                                           SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
        } else {
            w = [[NSWindow alloc] initWithContentRect:NSMakeRect(200, 200, 480, 270)
                                            styleMask:NSWindowStyleMaskTitled
                                              backing:NSBackingStoreBuffered defer:NO];
        }
        if (resetCs) w.colorSpace = nil;  // avant la mise à l'écran (prepareWindowForVideo)
        fprintf(stderr, "edr-calib: fenêtre %s, colorSpace %s\n", NSStringFromClass(w.class).UTF8String,
                w.colorSpace.localizedName.UTF8String);
        w.releasedWhenClosed = NO;
        w.title = @"edr-calib";
        w.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces |
                               NSWindowCollectionBehaviorFullScreenAuxiliary;
        w.level = NSFloatingWindowLevel;

        id<MTLDevice> dev = MTLCreateSystemDefaultDevice();
        CAMetalLayer* layer = [CAMetalLayer layer];
        layer.device = dev;
        layer.opaque = opaque;
        layer.framebufferOnly = !fbAny;
        layer.pixelFormat = bgr10 ? MTLPixelFormatBGR10A2Unorm : MTLPixelFormatRGBA16Float;
        CGColorSpaceRef cs = CGColorSpaceCreateWithName(pq ? kCGColorSpaceITUR_2100_PQ
                                                           : kCGColorSpaceExtendedLinearSRGB);
        layer.colorspace = cs;
        CGColorSpaceRelease(cs);
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        layer.wantsExtendedDynamicRangeContent = edr;
#pragma clang diagnostic pop
        if (meta)
            layer.EDRMetadata = [CAEDRMetadata HDR10MetadataWithMinLuminance:0.0001
                                                                 maxLuminance:1000
                                                           opticalOutputScale:metaScale];
        NSView* v = w.contentView;
        if (sublayer) {  // comme le compositeur du socle : vue hôte, racine retournée, sous-couche
            NSView* host = [[NSView alloc] initWithFrame:v.bounds];
            CALayer* root = [CALayer layer];
            root.geometryFlipped = YES;
            root.backgroundColor = CGColorGetConstantColor(kCGColorBlack);
            host.layer = root;
            host.wantsLayer = YES;
            v.wantsLayer = YES;
            [v addSubview:host positioned:NSWindowAbove relativeTo:nil];
            layer.frame = root.bounds;
            [root addSublayer:layer];
        } else {
            v.layer = layer;
            v.wantsLayer = YES;
        }
        layer.contentsScale = w.backingScaleFactor;
        layer.drawableSize = CGSizeMake(480 * w.backingScaleFactor, 270 * w.backingScaleFactor);
        if (sw) SDL_ShowWindow(sw);
        if (withMpv) {  // une instance libmpv dans le processus, sans sortie vidéo
            mpv_handle* m = mpv_create();
            mpv_set_option_string(m, "vo", "null");
            mpv_set_option_string(m, "idle", "yes");
            mpv_set_option_string(m, "terminal", "no");
            mpv_set_option_string(m, "media-controls", "no");
            fprintf(stderr, "edr-calib: mpv_initialize -> %d\n", mpv_initialize(m));
        }
        [w orderFrontRegardless];
        if (@available(macOS 26.0, *))
            fprintf(stderr, "edr-calib: preferredDynamicRange=%s contentsHeadroom=%.2f\n",
                    layer.preferredDynamicRange.UTF8String, (double)layer.contentsHeadroom);

        id<MTLCommandQueue> q = [dev newCommandQueue];
        // Motif de mpv, préparé une fois dans une texture BGR10A2 (même géométrie que le média).
        id<MTLTexture> pattern = nil;
        if (mpvPattern) {
            const int PW = layer.drawableSize.width, PH = layer.drawableSize.height;
            MTLTextureDescriptor* td = [MTLTextureDescriptor
                texture2DDescriptorWithPixelFormat:MTLPixelFormatBGR10A2Unorm width:PW height:PH mipmapped:NO];
            pattern = [dev newTextureWithDescriptor:td];
            std::vector<uint32_t> px(PW * PH);
            for (int y = 0; y < PH; y++)
                for (int x = 0; x < PW; x++) {
                    const double X = x * 1920.0 / PW, Y = y * 1080.0 / PH;
                    uint32_t c = X < 480 ? 509 : (X >= 760 && X < 1160 && Y >= 340 && Y < 740) ? 768
                               : X < 1440 ? 660 : 201;
                    px[y * PW + x] = (3u << 30) | (c << 20) | (c << 10) | c;
                }
            [pattern replaceRegion:MTLRegionMake2D(0, 0, PW, PH) mipmapLevel:0 withBytes:px.data()
                       bytesPerRow:PW * 4];
        }
        auto draw = [&] {
            id<CAMetalDrawable> d = [layer nextDrawable];
            if (!d) return;
            if (pattern) {
                id<MTLCommandBuffer> cb = [q commandBuffer];
                id<MTLBlitCommandEncoder> b = [cb blitCommandEncoder];
                [b copyFromTexture:pattern toTexture:d.texture];
                [b endEncoding];
                [cb presentDrawable:d];
                [cb commit];
                return;
            }
            MTLRenderPassDescriptor* rp = [MTLRenderPassDescriptor renderPassDescriptor];
            rp.colorAttachments[0].texture = d.texture;
            rp.colorAttachments[0].loadAction = MTLLoadActionClear;
            rp.colorAttachments[0].storeAction = MTLStoreActionStore;
            rp.colorAttachments[0].clearColor = MTLClearColorMake(value, value, value, 1);
            id<MTLCommandBuffer> cb = [q commandBuffer];
            [[cb renderCommandEncoderWithDescriptor:rp] endEncoding];
            [cb presentDrawable:d];
            [cb commit];
        };

        setvbuf(stdout, nullptr, _IOLBF, 0);
        NSDate* start = [NSDate date];
        double lastPrint = -1;
        while (-[start timeIntervalSinceNow] < seconds) {
            @autoreleasepool {
                NSDate* until = [NSDate dateWithTimeIntervalSinceNow:1.0 / 60];
                while (NSEvent* ev = [NSApp nextEventMatchingMask:NSEventMaskAny untilDate:until
                                                           inMode:NSDefaultRunLoopMode dequeue:YES])
                    [NSApp sendEvent:ev];
                draw();
                const double t = -[start timeIntervalSinceNow];
                if (t - lastPrint >= 0.25) {
                    stamp();
                    printf(" %.3f edr=%.3f occlusionVisible=%d\n", t,
                           w.screen.maximumExtendedDynamicRangeColorComponentValue,
                           (w.occlusionState & NSWindowOcclusionStateVisible) != 0);
                    lastPrint = t;
                }
            }
        }
        [w orderOut:nil];
    }
    return 0;
}
