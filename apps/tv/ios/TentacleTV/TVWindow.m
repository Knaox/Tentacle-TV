//
//  TVWindow.m  (tvOS / Apple TV) — fenêtrage DISQUE du lecteur « façon Infuse ».
//  Le remux COPIE la vidéo (pas de ré-encodage) → les seg*.m4s pèsent ~la taille du
//  fichier source. Un film 4K (50-80 Go) DÉPASSE le stockage Apple TV (32/64 Go) →
//  disque plein → CRASH. On PLAFONNE le disque en purgeant les segments DERRIÈRE la
//  tête de lecture (jamais ceux à/devant la tête : lecture avant intacte).
//
//  ⚠️ On NE modifie PAS la playlist (index.m3u8 reste EVENT/VOD complète) → AVPlayer
//  garde une timeline absolue seekable de bout en bout, et la lecture AVANT ne
//  redemande jamais un segment purgé. Un seek ARRIÈRE au-delà de la fenêtre conservée
//  tombera sur un 404 (segment purgé) → limitation connue (cf. brief recherche) ;
//  c'est pourquoi on garde une marge BEHIND généreuse pour les petits retours. Le
//  re-remux à la demande (av_seek_frame) est l'étape suivante, À VALIDER SUR DEVICE.
//
//  #importé par TVLocalRemux.m → même unité de traduction (pas dans project.pbxproj).
//

#import "TVCommon.h"

// Octets cumulés des segments de la session courante — lu par le pacing du moteur
// pour brider l'avance quand le disque approche le plafond (TVLR_DISK_CAP, TVCommon.h).
volatile long long gDiskBytes = 0;

// Purge les seg*.m4s trop en arrière de playPos + applique le plafond octets. Met à
// jour gDiskBytes. Ne touche JAMAIS init.mp4 / *.m3u8 ni un segment à/juste-avant la
// tête (marge de sécurité). Mapping index→temps via la durée MOYENNE réelle
// (gWrittenSec / nb_segments) → robuste quelle que soit la taille de GOP (≠ supposer
// hls_time=2s, qui purgerait l'avant si les segments sont plus longs).
static void TVPurgeBehind(const char *dstC, int gen, double playPos) {
  if (gen != gGen || playPos < 1.0) return;   // pas avant le démarrage réel de la lecture
  @autoreleasepool {
    NSString *dir = [NSString stringWithUTF8String:dstC];
    NSFileManager *fm = [NSFileManager defaultManager];
    NSArray<NSString *> *files = [fm contentsOfDirectoryAtPath:dir error:nil];
    if (!files) return;

    // Collecte (index, taille) des segments, total disque, index max (= plus récent).
    NSMutableArray<NSNumber *> *idxs = [NSMutableArray array];
    NSMutableDictionary<NSNumber *, NSNumber *> *sizes = [NSMutableDictionary dictionary];
    long long total = 0; int maxIdx = -1;
    for (NSString *f in files) {
      if (![f hasPrefix:@"seg"] || ![f.pathExtension.lowercaseString isEqualToString:@"m4s"]) continue;  // ignore .tmp / init.mp4 / *.m3u8
      int idx = [[[f stringByDeletingPathExtension] substringFromIndex:3] intValue];
      long long sz = TVFileSize([dir stringByAppendingPathComponent:f]);
      [idxs addObject:@(idx)]; sizes[@(idx)] = @(sz); total += sz;
      if (idx > maxIdx) maxIdx = idx;
    }
    if (idxs.count == 0 || maxIdx < 0) { gDiskBytes = 0; return; }
    [idxs sortUsingSelector:@selector(compare:)];

    // Segments 0-based (make_zero) : gWrittenSec et playPos (= gTVPlayPos, brut d'AVPlayer) sont TOUS
    // relatifs au début de session → mapping index↔temps direct, sans gSessionStartSec.
    double avgSeg = (gWrittenSec > 1.0) ? (gWrittenSec / (double)(maxIdx + 1)) : 2.0;
    if (avgSeg < 0.5) avgSeg = 0.5;
    int headIdx = (int)(playPos / avgSeg);
    if (headIdx > maxIdx) headIdx = maxIdx;     // la tête ne dépasse jamais l'écrit
    int safeFloor = headIdx - 4;                // ne JAMAIS purger les ~4 segments autour/avant la tête
    int timeFloor = headIdx - (int)(TVLR_BEHIND_SEC / avgSeg);  // fenêtre BEHIND conservée

    // Du plus ancien au plus récent : purger si HORS fenêtre BEHIND, OU si plafond
    // octets dépassé (jusqu'à la marge de sécurité). S'arrêter avant la tête.
    for (NSNumber *n in idxs) {
      int idx = n.intValue;
      if (idx >= safeFloor) break;              // proche/devant la tête → ne plus rien purger
      BOOL behindWindow = idx < timeFloor;
      BOOL overCap = total > TVLR_DISK_CAP;
      if (!behindWindow && !overCap) break;     // dans la fenêtre ET sous le plafond → garder le reste
      NSString *p = [dir stringByAppendingPathComponent:[NSString stringWithFormat:@"seg%05d.m4s", idx]];
      if ([fm removeItemAtPath:p error:nil]) total -= sizes[n].longLongValue;
    }
    gDiskBytes = total;
  }
}
