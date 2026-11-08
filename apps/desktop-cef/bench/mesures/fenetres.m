// Fenêtres à l'écran, de la plus haute à la plus basse (CGWindowList) : propriétaire, pid,
// numéro de fenêtre (pour `screencapture -l`), cadre. Sert au harnais à vérifier que l'app
// mesurée est bien visible, devant.
//   clang -fobjc-arc -framework Foundation -framework CoreGraphics bench/mesures/fenetres.m -o …/fenetres
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>

int main(int argc, char** argv) {
  @autoreleasepool {
    NSArray* list = CFBridgingRelease(CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID));
    int shown = 0;
    for (NSDictionary* w in list) {
      if ([w[(id)kCGWindowLayer] intValue] != 0) continue;  // fenêtres normales seulement
      CGRect r;
      CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)w[(id)kCGWindowBounds], &r);
      if (r.size.width < 100 || r.size.height < 100) continue;
      printf("%-28s pid %-6d fenêtre %-6d %4.0fx%-4.0f à %4.0f,%-4.0f\n",
             [w[(id)kCGWindowOwnerName] UTF8String], [w[(id)kCGWindowOwnerPID] intValue],
             [w[(id)kCGWindowNumber] intValue], r.size.width, r.size.height, r.origin.x, r.origin.y);
      if (++shown >= (argc > 1 ? atoi(argv[1]) : 6)) break;
    }
  }
  return 0;
}
