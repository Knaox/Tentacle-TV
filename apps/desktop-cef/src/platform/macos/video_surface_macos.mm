// VideoSurface macOS : une CAMetalLayer à nous, que le compositeur du socle range sous la page
// (nativeLayer). mpv y dessine par le contexte `moltenvk` (fork : --wid = cette couche). MoltenVK pose
// lui-même colorspace (ITUR_2100_PQ…), EDR et métadonnées HDR quand libplacebo choisit une
// sortie HDR : la couche ne force RIEN côté couleur, elle se contente de le journaliser.

#import <AppKit/AppKit.h>
#import <Metal/Metal.h>
#import <QuartzCore/QuartzCore.h>

#include <atomic>
#include <cstdio>
#include <cstring>
#include <sys/time.h>

#include "platform/video_surface.h"

namespace {

bool layerLogEnabled() {
    static const bool on = getenv("TENTACLE_VIDEO_LAYER_LOG") != nullptr;
    return on;
}

// Journal horodaté (horloge murale, comme edr-probe) — appelé depuis n'importe quel fil.
void layerLog(NSString* msg) {
    if (!layerLogEnabled()) return;
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    struct tm tmv;
    localtime_r(&tv.tv_sec, &tmv);
    char buf[32];
    strftime(buf, sizeof buf, "%H:%M:%S", &tmv);
    fprintf(stderr, "[video-layer %s.%03d] %s\n", buf, (int)(tv.tv_usec / 1000), msg.UTF8String);
}

std::string pixelFormatName(MTLPixelFormat f) {
    switch (f) {
        case MTLPixelFormatBGRA8Unorm: return "BGRA8Unorm";
        case MTLPixelFormatBGRA8Unorm_sRGB: return "BGRA8Unorm_sRGB";
        case MTLPixelFormatRGBA16Float: return "RGBA16Float";
        case MTLPixelFormatRGB10A2Unorm: return "RGB10A2Unorm";
        case MTLPixelFormatBGR10A2Unorm: return "BGR10A2Unorm";
        case MTLPixelFormatBGR10_XR: return "BGR10_XR";
        case MTLPixelFormatBGR10_XR_sRGB: return "BGR10_XR_sRGB";
        default: return "MTLPixelFormat(" + std::to_string((unsigned long)f) + ")";
    }
}

std::string colorspaceName(CGColorSpaceRef cs) {
    if (!cs) return "";
    CFStringRef name = CGColorSpaceCopyName(cs);
    if (!name) return "(sans nom)";
    std::string out = ((__bridge NSString*)name).UTF8String;
    CFRelease(name);
    return out;
}

}  // namespace

// Mêmes garde-fous que la MetalLayer de mpv (video/out/mac/metal_layer.swift) : MoltenVK
// pose parfois drawableSize = 1×1 pour forcer la fin d'une présentation (scintillement), et
// bascule isOpaque même sans contenu transparent. Chaque changement de couleur est journalisé.
@interface TentacleVideoLayer : CAMetalLayer
@end

// MoltenVK règle colorspace / EDR / métadonnées / format depuis le fil du VO de mpv, un fil
// sans boucle d'exécution : la transaction Core Animation implicite qui porte ces changements
// n'y est jamais validée d'elle-même. La couche « locale » dit PQ + EDR, le serveur d'affichage
// la voit toujours sRGB/SDR → marge 1,00 (mpv natif compris). On valide donc tout de suite.
static void commitIfBackground() {
    if (NSThread.isMainThread || getenv("TENTACLE_NO_CA_FLUSH")) return;  // preuve (banc)
    [CATransaction flush];
}

@implementation TentacleVideoLayer {
    id<CAMetalDrawable> lastDrawable_;  // diagnostic (TENTACLE_LAYER_SAMPLE) seulement
    std::atomic<long> acquired_, presented_, dropped_;
}
- (id<CAMetalDrawable>)nextDrawable {
    id<CAMetalDrawable> d = [super nextDrawable];
    if (getenv("TENTACLE_LAYER_SAMPLE")) {
        @synchronized(self) { lastDrawable_ = d; }
        acquired_++;
        __weak TentacleVideoLayer* weakSelf = self;
        [d addPresentedHandler:^(id<MTLDrawable> drawable) {
            TentacleVideoLayer* me = weakSelf;
            if (!me) return;
            if (drawable.presentedTime > 0) me->presented_++; else me->dropped_++;
        }];
    }
    return d;
}
// Diagnostic : valeurs brutes (R,G,B 10 bits) du dernier drawable remis à MoltenVK, au point
// (x, y) en pixels. Lisible car MoltenVK crée la couche avec framebufferOnly = NO.
- (NSString*)tentaclePresentStats {
    return [NSString stringWithFormat:@"acquis=%ld présentés=%ld non-affichés=%ld",
            acquired_.load(), presented_.load(), dropped_.load()];
}
- (NSString*)tentacleSampleAtX:(int)x y:(int)y {
    id<MTLTexture> tex;
    @synchronized(self) { tex = lastDrawable_.texture; }
    if (!tex || tex.framebufferOnly) return @"indisponible";
    id<MTLCommandQueue> q = [tex.device newCommandQueue];
    id<MTLBuffer> buf = [tex.device newBufferWithLength:4 options:MTLResourceStorageModeShared];
    id<MTLCommandBuffer> cb = [q commandBuffer];
    id<MTLBlitCommandEncoder> blit = [cb blitCommandEncoder];
    [blit copyFromTexture:tex sourceSlice:0 sourceLevel:0 sourceOrigin:MTLOriginMake(x, y, 0)
               sourceSize:MTLSizeMake(1, 1, 1) toBuffer:buf destinationOffset:0
      destinationBytesPerRow:4 destinationBytesPerImage:4];
    [blit endEncoding];
    [cb commit];
    [cb waitUntilCompleted];
    const uint32_t v = *(const uint32_t*)buf.contents;
    // BGR10A2Unorm : B bits 0-9, G 10-19, R 20-29, A 30-31.
    return [NSString stringWithFormat:@"R=%u G=%u B=%u A=%u fmt=%lu",
            (v >> 20) & 1023, (v >> 10) & 1023, v & 1023, v >> 30, (unsigned long)tex.pixelFormat];
}
- (void)setDrawableSize:(CGSize)size {
    if (size.width > 1 && size.height > 1) [super setDrawableSize:size];
}
- (void)setOpaque:(BOOL)opaque {
    // Expérience (banc) : TENTACLE_LAYER_TRANSLUCENT=1 → couche non opaque (pas de
    // « direct-to-display »), pour comparer la marge EDR accordée.
    [super setOpaque:getenv("TENTACLE_LAYER_TRANSLUCENT") ? NO : YES];
}
- (void)setColorspace:(CGColorSpaceRef)cs {
    std::string before = colorspaceName(self.colorspace), after = colorspaceName(cs);
    [super setColorspace:cs];
    // MoltenVK ne retire jamais les métadonnées HDR en repassant en SDR : mesuré, la marge
    // restait à 8,4 sur un SDR qui suivait un HDR. Une couche non PQ/HLG n'en garde aucune.
    if (cs && !CGColorSpaceUsesITUR_2100TF(cs) && self.EDRMetadata) {
        [super setEDRMetadata:nil];
        layerLog(@"edrMetadata -> nil (couche SDR)");
    }
    commitIfBackground();
    if (before != after)
        layerLog([NSString stringWithFormat:@"colorspace %s -> %s", before.c_str(), after.c_str()]);
}
- (void)setPixelFormat:(MTLPixelFormat)f {
    MTLPixelFormat before = self.pixelFormat;
    [super setPixelFormat:f];
    commitIfBackground();
    if (before != f)
        layerLog([NSString stringWithFormat:@"pixelFormat -> %s", pixelFormatName(f).c_str()]);
}
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
- (void)setWantsExtendedDynamicRangeContent:(BOOL)v {
    BOOL before = self.wantsExtendedDynamicRangeContent;
    [super setWantsExtendedDynamicRangeContent:v];
    commitIfBackground();
    if (before != v) layerLog([NSString stringWithFormat:@"wantsEDR -> %d", v]);
}
#pragma clang diagnostic pop
- (void)setEDRMetadata:(CAEDRMetadata*)m {
    // Expérience (banc) : MoltenVK 1.4.2 construit ces métadonnées avec opticalOutputScale = 1
    // (MVKSwapchain.mm:377) là où la recette HDR10 d'Apple met 100.
    // TENTACLE_EDR_META = keep (défaut) | none (aucune) | scale100 (HDR10 1 000 nits, échelle 100).
    const char* mode = getenv("TENTACLE_EDR_META");
    if (m && mode && !strcmp(mode, "none")) m = nil;
    else if (m && mode && !strcmp(mode, "scale100"))
        m = [CAEDRMetadata HDR10MetadataWithMinLuminance:0.0001 maxLuminance:1000 opticalOutputScale:100];
    [super setEDRMetadata:m];
    commitIfBackground();
    layerLog([NSString stringWithFormat:@"edrMetadata -> %@ (mode %s)", m ? @"set" : @"nil", mode ?: "keep"]);
}
@end

namespace tentacle {
namespace {

// SDL3 marque sa NSWindow en sRGB (setColorSpace:) — constaté (« sRGB IEC61966-2.1 » contre
// « Color LCD » pour une NSWindow ordinaire). Une fenêtre sRGB peut priver de l'EDR les couches
// qu'elle contient : écarté le 03/11 (témoin dans une fenêtre SDL3 restée sRGB → 8,44). On
// rend quand même l'espace par défaut (couleurs de la page gérées comme partout), sans
// retrait/remise à l'écran pour une fenêtre déjà visible. Les couches de
// la page (CEF) portent alors leur propre colorspace sRGB (cf. jellium d55ff73).
void releaseWindowColorSpace(NSWindow* window, bool reorderIfVisible) {
    if (getenv("TENTACLE_KEEP_WINDOW_COLORSPACE")) return;  // preuve du défaut (banc)
    NSColorSpace* before = window.colorSpace;
    if (!before || [before isEqual:window.screen.colorSpace]) return;
    window.colorSpace = nil;  // retour au défaut : l'espace de l'écran, suivi par AppKit
    layerLog([NSString stringWithFormat:@"window colorSpace %@ -> %@", before.localizedName,
                                        window.colorSpace.localizedName]);
    if (reorderIfVisible && window.visible) {
        const bool wasKey = window.keyWindow;
        [window orderOut:nil];
        if (wasKey) [window makeKeyAndOrderFront:nil];
        else [window orderFrontRegardless];
        layerLog(@"window re-ordered (déjà visible : l'espace de couleur n'est relu qu'à la mise à l'écran)");
    }
}

class MacVideoSurface final : public VideoSurface {
public:
    explicit MacVideoSurface(NSWindow* window) : window_(window) {
        releaseWindowColorSpace(window, /*reorderIfVisible=*/false);
        layer_ = [TentacleVideoLayer layer];
        layer_.device = MTLCreateSystemDefaultDevice();
        layer_.framebufferOnly = YES;
        layer_.opaque = YES;
        layer_.anchorPoint = CGPointZero;
        layer_.backgroundColor = CGColorGetConstantColor(kCGColorBlack);
        // ProMotion : 3 drawables pour laisser l'écran monter à 120 Hz (cf. jellium 4d0952e).
        layer_.maximumDrawableCount = 3;
        // Pas d'animation implicite : le contenu change à chaque image.
        layer_.actions = @{@"bounds": NSNull.null, @"position": NSNull.null,
                           @"frame": NSNull.null, @"hidden": NSNull.null,
                           @"contents": NSNull.null, @"anchorPoint": NSNull.null};
        layer_.contentsScale = window.backingScaleFactor;
        // Changement d'écran ou de facteur Retina : la taille en pixels change.
        observer_ = [NSNotificationCenter.defaultCenter
            addObserverForName:NSWindowDidChangeBackingPropertiesNotification
                        object:window
                         queue:nil
                    usingBlock:^(NSNotification*) { this->updateDrawableSize(); }];
        layerLog([NSString stringWithFormat:@"born %p", layer_]);
    }

    ~MacVideoSurface() override {
        [NSNotificationCenter.defaultCenter removeObserver:observer_];
        [layer_ removeFromSuperlayer];  // si le compositeur ne l'a pas déjà fait
        layerLog([NSString stringWithFormat:@"removed %p", layer_]);
    }

    void show() override { layer_.hidden = NO; }
    void hide() override { layer_.hidden = YES; }
    bool visible() const override { return !layer_.hidden; }

    void setFrame(RectPt f) override {
        [CATransaction begin];
        [CATransaction setDisableActions:YES];
        layer_.frame = CGRectMake(f.x, f.y, f.width, f.height);
        [CATransaction commit];
        updateDrawableSize();
    }

    double backingScale() const override { return window_.backingScaleFactor; }
    void* nativeLayer() override { return (__bridge void*)layer_; }
    PixelSize pixelSize() const override { return size_; }
    int64_t mpvWid() const override { return (int64_t)(intptr_t)(__bridge void*)layer_; }
    const char* mpvGpuContext() const override { return "moltenvk"; }

    SurfaceColorState colorState() const override {
        SurfaceColorState s;
        s.colorspace = colorspaceName(layer_.colorspace);
        s.pixelFormat = pixelFormatName(layer_.pixelFormat);
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        s.wantsEdr = layer_.wantsExtendedDynamicRangeContent;
#pragma clang diagnostic pop
        s.hasEdrMetadata = layer_.EDRMetadata != nil;
        s.opaque = layer_.opaque;
        s.windowFullscreen = (window_.styleMask & NSWindowStyleMaskFullScreen) != 0;
        const NSRect f = window_.frame;
        s.windowFrame = {f.origin.x, f.origin.y, f.size.width, f.size.height};
        return s;
    }

    void onPixelSizeChanged(std::function<void(PixelSize)> cb) override {
        sizeCb_ = std::move(cb);
    }

    // PiP : la couche passe dans une autre fenêtre (peut-être sur un autre écran, d'une autre
    // échelle) — on suit désormais la sienne.
    void setHostWindow(void* nativeWindow) override {
        NSWindow* window = (__bridge NSWindow*)nativeWindow;
        if (![window isKindOfClass:[NSWindow class]] || window == window_) return;
        [NSNotificationCenter.defaultCenter removeObserver:observer_];
        window_ = window;
        observer_ = [NSNotificationCenter.defaultCenter
            addObserverForName:NSWindowDidChangeBackingPropertiesNotification
                        object:window
                         queue:nil
                    usingBlock:^(NSNotification*) { this->updateDrawableSize(); }];
        updateDrawableSize();
    }

private:
    void updateDrawableSize() {
        const CGFloat scale = window_.backingScaleFactor;
        layer_.contentsScale = scale;
        const CGSize pt = layer_.bounds.size;
        PixelSize px{(int)(pt.width * scale + 0.5), (int)(pt.height * scale + 0.5)};
        if (px.w == size_.w && px.h == size_.h) return;
        size_ = px;
        // Repli seulement : mpv redimensionne son swapchain par --moltenvk-surface-size (le
        // rappel ci-dessous, transmis par le Player) et MoltenVK repose drawableSize.
        if (px.w > 1 && px.h > 1) layer_.drawableSize = CGSizeMake(px.w, px.h);
        layerLog([NSString stringWithFormat:@"pixel size %d x %d", px.w, px.h]);
        if (sizeCb_) sizeCb_(px);
    }

    NSWindow* window_;
    TentacleVideoLayer* layer_ = nil;
    id observer_ = nil;
    PixelSize size_;
    std::function<void(PixelSize)> sizeCb_;
};

}  // namespace

void prepareWindowForVideo(void* nativeWindow) {
    NSWindow* window = (__bridge NSWindow*)nativeWindow;
    if ([window isKindOfClass:[NSWindow class]]) releaseWindowColorSpace(window, false);
}

std::unique_ptr<VideoSurface> createVideoSurface(void* nativeWindow) {
    NSWindow* window = (__bridge NSWindow*)nativeWindow;
    if (![window isKindOfClass:[NSWindow class]]) return nullptr;
    return std::make_unique<MacVideoSurface>(window);
}

}  // namespace tentacle
