#pragma once
// Utilitaires du banc HDR (Objective-C++) : journal horodaté, état des couches, hôte de couches
// calqué sur le compositeur macOS du socle (vue « hôte de couches » au-dessus du contenu SDL,
// couche racine retournée, vidéo en bas, voile « page » au-dessus).

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>

#include <cstdio>
#include <cstring>
#include <string>
#include <sys/time.h>

namespace tentacle::bench {

inline FILE*& out() { static FILE* f = stdout; return f; }

inline std::string wallClock() {  // même horloge et même format que edr-probe
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    struct tm tmv;
    localtime_r(&tv.tv_sec, &tmv);
    char buf[48];
    size_t n = strftime(buf, sizeof buf, "%Y-%m-%dT%H:%M:%S", &tmv);
    snprintf(buf + n, sizeof buf - n, ".%03d", (int)(tv.tv_usec / 1000));
    return buf;
}

inline void emit(const char* kind, const std::string& json) {
    static std::string lastTarget;  // video-target-params : une ligne par changement
    if (!strcmp(kind, "video-target-params")) {
        if (json == lastTarget) return;
        lastTarget = json;
    }
    fprintf(out(), "%s %s %s\n", wallClock().c_str(), kind, json.c_str());
    fflush(out());
}

inline std::string csName(CGColorSpaceRef cs) {
    if (!cs) return "";
    CFStringRef n = CGColorSpaceCopyName(cs);
    std::string s = n ? ((__bridge NSString*)n).UTF8String : "(sans nom)";
    if (n) CFRelease(n);
    return s;
}

// État de la couche où mpv dessine (la nôtre, ou celle de la fenêtre de mpv en --native).
inline void logLayer(CAMetalLayer* layer, const char* when) {
    if (!layer) { emit("surface", std::string("{\"when\":\"") + when + "\",\"layer\":null}"); return; }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    const bool edr = layer.wantsExtendedDynamicRangeContent;
#pragma clang diagnostic pop
    char buf[512];
    snprintf(buf, sizeof buf,
             "{\"when\":\"%s\",\"colorspace\":\"%s\",\"pixelFormat\":\"%lu\",\"wantsEDR\":%s,"
             "\"edrMetadata\":%s,\"opaque\":%s,\"px\":\"%.0fx%.0f\"}",
             when, csName(layer.colorspace).c_str(), (unsigned long)layer.pixelFormat,
             edr ? "true" : "false", layer.EDRMetadata ? "true" : "false",
             layer.opaque ? "true" : "false", layer.drawableSize.width, layer.drawableSize.height);
    emit("surface", buf);
}

// Propriétés de couche qui peuvent conditionner l'EDR (lues par KVC si l'OS les connaît).
inline void dumpLayer(CAMetalLayer* l) {
    if (!l) return;
    NSMutableString* d = [NSMutableString stringWithString:@"{"];
    for (NSString* k in @[@"preferredDynamicRange", @"contentsHeadroom", @"toneMapMode",
                          @"displaySyncEnabled", @"presentsWithTransaction", @"framebufferOnly",
                          @"maximumDrawableCount", @"opaque", @"hidden", @"opacity",
                          @"contentsFormat", @"wantsExtendedDynamicRangeContent"]) {
        if (![l respondsToSelector:NSSelectorFromString(k)]) continue;
        @try { [d appendFormat:@"\"%@\":\"%@\",", k, [l valueForKey:k]]; } @catch (id) {}
    }
    [d appendFormat:@"\"EDRMetadata\":\"%@\"}", [l.EDRMetadata.description
        stringByReplacingOccurrencesOfString:@"\"" withString:@"'"] ?: @"nil"];
    emit("layer-props", [[d stringByReplacingOccurrencesOfString:@"\n" withString:@" "] UTF8String]);
}

// Visibilité réelle de la fenêtre et son espace de couleur (l'EDR en dépend).
inline void logWindow(NSWindow* w) {
    NSString* d = [NSString stringWithFormat:
        @"{\"onActiveSpace\":%d,\"occlusionVisible\":%d,\"appActive\":%d,\"level\":%ld,"
        @"\"fullscreen\":%d,\"colorSpace\":\"%@\",\"screenEdrNow\":%.3f}",
        w.isOnActiveSpace, (w.occlusionState & NSWindowOcclusionStateVisible) != 0,
        NSApp.isActive, (long)w.level, (w.styleMask & NSWindowStyleMaskFullScreen) != 0,
        w.colorSpace.localizedName, w.screen.maximumExtendedDynamicRangeColorComponentValue];
    emit("window", d.UTF8String);
}

inline CAMetalLayer* findMetalLayer(CALayer* l) {
    if ([l isKindOfClass:[CAMetalLayer class]]) return (CAMetalLayer*)l;
    for (CALayer* c in l.sublayers)
        if (CAMetalLayer* m = findMetalLayer(c)) return m;
    return nil;
}

// Mesure seulement : la fenêtre doit être VISIBLE pour que macOS accorde l'EDR. Si l'espace
// courant est une app en plein écran, une fenêtre normale naît hors écran : on la rend
// auxiliaire plein écran + flottante, sans activer l'app (pas de vol de focus).
inline void makeVisibleForMeasure(NSWindow* w) {
    w.collectionBehavior |= NSWindowCollectionBehaviorCanJoinAllSpaces |
                            NSWindowCollectionBehaviorFullScreenAuxiliary;
    w.level = NSFloatingWindowLevel;
    [w orderFrontRegardless];
}

}  // namespace tentacle::bench

// Comme TentacleLayerHostView du socle : ne prend aucun clic, la saisie reste à SDL.
@interface BenchLayerHostView : NSView
@end
@implementation BenchLayerHostView
- (NSView*)hitTest:(NSPoint)point { return nil; }
@end

namespace tentacle::bench {

// Hôte de couches : racine retournée (origine en haut à gauche), vidéo à z=0, voile à z=10.
struct LayerHost {
    BenchLayerHostView* view = nil;
    CALayer* root = nil;
    CALayer* veil = nil;

    explicit LayerHost(NSWindow* window) {
        NSView* content = window.contentView;
        view = [[BenchLayerHostView alloc] initWithFrame:content.bounds];
        root = [CALayer layer];
        root.geometryFlipped = YES;
        root.backgroundColor = CGColorGetConstantColor(kCGColorBlack);
        root.actions = @{@"bounds": NSNull.null, @"sublayers": NSNull.null};
        view.layer = root;  // vue hôte : la couche est à nous
        view.wantsLayer = YES;
        view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
        content.wantsLayer = YES;
        [content addSubview:view positioned:NSWindowAbove relativeTo:nil];
    }
    void addVideo(CALayer* layer) {
        layer.zPosition = 0;
        [root addSublayer:layer];
    }
    // Simule la page CEF : une bande de « contrôles » semi-transparente, en sRGB, en bas.
    void addVeil(double alpha) {
        veil = [CALayer layer];
        veil.zPosition = 10;
        veil.actions = @{@"frame": NSNull.null, @"bounds": NSNull.null, @"position": NSNull.null};
        CGColorSpaceRef srgb = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
        const CGFloat c[] = {0.1, 0.1, 0.12, alpha};
        CGColorRef col = CGColorCreate(srgb, c);
        veil.backgroundColor = col;
        CGColorRelease(col);
        CGColorSpaceRelease(srgb);
        [root addSublayer:veil];
    }
    CGSize size() const { return view.bounds.size; }
    void layoutVeil() {
        if (!veil) return;
        [CATransaction begin];
        [CATransaction setDisableActions:YES];
        veil.frame = CGRectMake(0, size().height - 120, size().width, 120);
        [CATransaction commit];
    }
};

}  // namespace tentacle::bench
