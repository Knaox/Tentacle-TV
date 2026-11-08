// edr-probe — sonde EXTERNE de la marge EDR de l'écran.
//
// Échantillonne NSScreen.maximumExtendedDynamicRangeColorComponentValue (la marge accordée
// MAINTENANT par le compositeur : 1,00 = pas d'EDR) à haute fréquence, avec horodatage.
// Binaire séparé du lecteur : il ne voit que ce que macOS accorde, pas ce que mpv prétend.
//
// Usage : edr-probe [--hz N] [--duration S] [--screen I] [--changes]
//   --changes : n'écrit une ligne qu'au changement de valeur (plus le premier échantillon).
// Sortie (stdout, une ligne par échantillon) :
//   <horodatage ISO-8601 ms> <secondes depuis le départ> edr=<valeur> potential=<valeur> ref=<valeur>
// En fin : un résumé « summary min=… max=… samples=… ».

#import <AppKit/AppKit.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <sys/time.h>

static void printTimestamp() {
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
        double hz = 20.0;
        double duration = 0.0;  // 0 = jusqu'à SIGINT/SIGTERM
        int screenIndex = 0;
        bool changesOnly = false;
        for (int i = 1; i < argc; i++) {
            if (!strcmp(argv[i], "--hz") && i + 1 < argc) hz = atof(argv[++i]);
            else if (!strcmp(argv[i], "--duration") && i + 1 < argc) duration = atof(argv[++i]);
            else if (!strcmp(argv[i], "--screen") && i + 1 < argc) screenIndex = atoi(argv[++i]);
            else if (!strcmp(argv[i], "--changes")) changesOnly = true;
            else {
                fprintf(stderr, "usage: edr-probe [--hz N] [--duration S] [--screen I] [--changes]\n");
                return 2;
            }
        }
        if (hz <= 0) hz = 20.0;

        // Une application sans icône ni fenêtre : NSScreen a besoin d'une connexion au
        // serveur de fenêtres, pas d'une fenêtre.
        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
        [NSApp finishLaunching];

        NSArray<NSScreen*>* screens = [NSScreen screens];
        if (screenIndex < 0 || screenIndex >= (int)screens.count) {
            fprintf(stderr, "edr-probe: screen %d absent (%lu écrans)\n", screenIndex,
                    (unsigned long)screens.count);
            return 1;
        }
        NSScreen* screen = screens[screenIndex];
        fprintf(stderr, "edr-probe: écran %d « %s », %.0f Hz, potentiel %.2f\n", screenIndex,
                screen.localizedName.UTF8String, (double)screen.maximumFramesPerSecond,
                (double)screen.maximumPotentialExtendedDynamicRangeColorComponentValue);

        setvbuf(stdout, nullptr, _IOLBF, 0);
        const NSTimeInterval period = 1.0 / hz;
        NSDate* start = [NSDate date];
        double minV = 1e9, maxV = 0, last = -1;
        long samples = 0;
        while (true) {
            @autoreleasepool {
                // Pomper les évènements AppKit : c'est par eux que le serveur de fenêtres
                // annonce les changements d'écran (marge EDR comprise). Faire seulement
                // tourner NSRunLoop ne suffit PAS — mesuré : valeur figée à la 1re lecture.
                NSDate* until = [NSDate dateWithTimeIntervalSinceNow:period];
                while (NSEvent* ev = [NSApp nextEventMatchingMask:NSEventMaskAny
                                                        untilDate:until
                                                           inMode:NSDefaultRunLoopMode
                                                          dequeue:YES]) {
                    [NSApp sendEvent:ev];
                }
                NSScreen* s = [NSScreen screens].count > (NSUInteger)screenIndex
                                  ? [NSScreen screens][screenIndex] : screen;
                double v = s.maximumExtendedDynamicRangeColorComponentValue;
                double pot = s.maximumPotentialExtendedDynamicRangeColorComponentValue;
                double ref = s.maximumReferenceExtendedDynamicRangeColorComponentValue;
                double t = -[start timeIntervalSinceNow];
                samples++;
                if (v < minV) minV = v;
                if (v > maxV) maxV = v;
                if (!changesOnly || v != last) {
                    printTimestamp();
                    printf(" %.3f edr=%.3f potential=%.3f ref=%.3f\n", t, v, pot, ref);
                }
                last = v;
                if (duration > 0 && t >= duration) break;
            }
        }
        printf("summary min=%.3f max=%.3f samples=%ld\n", minV, maxV, samples);
    }
    return 0;
}
