//
//  TVLogBuffer.m  (tvOS / Apple TV) — ring buffer des logs du remux, ponté vers JS.
//  TVLOG (TVCommon.h) écrit chaque ligne ICI en plus d'os_log ; le JS draine via
//  TVLocalRemux.fetchLogs (poll ~2 s, useTVRemuxLogPump) → les lignes arrivent
//  dans la console Metro pendant les sessions de dev sur device physique
//  (diagnostic des lectures longues sans Console.app). Thread-safe : TVLOG est
//  appelé depuis la boucle FFmpeg (gRemuxQueue), les workers GCDWebServer et la
//  main queue. #importé par TVLocalRemux.m (unity build) — PAS au projet Xcode.
//

#import "TVCommon.h"
#import <os/lock.h>

#define TVLOG_BUF_CAP 500   // lignes conservées entre deux drains (au-delà : drop + compteur)

static os_unfair_lock gLogLock = OS_UNFAIR_LOCK_INIT;
static NSMutableArray<NSString *> *gLogLines;
static int gLogDropped = 0;
static double gLogT0 = 0;   // uptime du 1ᵉʳ log → timestamps relatifs « +123.4s »

// Normalise les annotations os_log (« %{public}s » → « %s ») puis formate façon
// printf — les specifiers de base des TVLOG (%d %s %.3f %lld…) sont communs.
void TVLogAppendFmt(const char *fmt, ...) {
  char clean[512]; size_t o = 0;
  for (const char *p = fmt; *p && o < sizeof(clean) - 1; p++) {
    clean[o++] = *p;
    if (*p == '%' && p[1] == '{') {              // saute l'annotation {public}/{private}
      const char *close = strchr(p + 1, '}');
      if (close) p = close;
    }
  }
  clean[o] = 0;
  char line[512];
  va_list ap; va_start(ap, fmt);
  vsnprintf(line, sizeof(line), clean, ap);
  va_end(ap);

  double up = [NSProcessInfo processInfo].systemUptime;
  @autoreleasepool {
    os_unfair_lock_lock(&gLogLock);
    if (!gLogLines) { gLogLines = [NSMutableArray arrayWithCapacity:TVLOG_BUF_CAP]; gLogT0 = up; }
    if (gLogLines.count >= TVLOG_BUF_CAP) { [gLogLines removeObjectAtIndex:0]; gLogDropped++; }
    [gLogLines addObject:[NSString stringWithFormat:@"+%.1fs %s", up - gLogT0, line]];
    os_unfair_lock_unlock(&gLogLock);
  }
}

// Drain : renvoie les lignes accumulées (+ une synthèse si le ring a débordé
// entre deux drains) et vide le buffer.
NSArray<NSString *> *TVLogDrain(void) {
  os_unfair_lock_lock(&gLogLock);
  NSArray<NSString *> *out = gLogLines ? [gLogLines copy] : @[];
  [gLogLines removeAllObjects];
  int dropped = gLogDropped; gLogDropped = 0;
  os_unfair_lock_unlock(&gLogLock);
  if (dropped > 0)
    out = [out arrayByAddingObject:[NSString stringWithFormat:@"(ring plein : %d lignes perdues)", dropped]];
  return out;
}
