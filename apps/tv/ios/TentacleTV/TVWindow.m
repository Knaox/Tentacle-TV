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

// Vraie pause permanente : définis ICI (TVRemuxEngine.m est à la limite de 300 lignes). Le pacing du moteur
// bloque déjà naturellement en pause (gTVPlayPos figé) ; ces globals ne pilotent QUE le manifeste servi.
volatile int gPaused = 0;
volatile int gResumePending = 0;
volatile int gSnapshotMode = 0;   // défaut ALIGNÉ sur le runtime réel : keepalive EVENT (variante A, poussée par
                                  // useTVRemuxPause au montage). L'ancien défaut 1 (VOD) ne servait que si le JS
                                  // n'avait pas encore poussé le mode → comportement divergent piégeux.

// Bornes [min..max] des index de segments seg*.m4s présents sur disque (-1 si aucun).
// Partagé : diagnostic du handler 404 (segment purgé vs pas encore produit) + long-poll.
static void TVSegBounds(NSString *dir, int *minIdx, int *maxIdx) {
  int mn = -1, mx = -1;
  NSArray<NSString *> *files = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:dir error:nil];
  for (NSString *f in files ?: @[]) {
    if (![f hasPrefix:@"seg"] || ![f.pathExtension.lowercaseString isEqualToString:@"m4s"]) continue;
    int idx = [[[f stringByDeletingPathExtension] substringFromIndex:3] intValue];
    if (mn < 0 || idx < mn) mn = idx;
    if (idx > mx) mx = idx;
  }
  *minIdx = mn; *maxIdx = mx;
}

// Purge les seg*.m4s trop en arrière de playPos + applique le plafond octets. Met à
// jour gDiskBytes. Ne touche JAMAIS init.mp4 / *.m3u8 ni un segment à/juste-avant la
// tête (marge de sécurité). Mapping index→temps via la durée MOYENNE réelle
// (gWrittenSec / nb_segments) → robuste quelle que soit la taille de GOP (≠ supposer
// hls_time=2s, qui purgerait l'avant si les segments sont plus longs).
static void TVPurgeBehind(const char *dstC, int gen, double playPos) {
  if (gen != gGen || playPos < 1.0) return;   // pas avant le démarrage réel de la lecture
  if (gPaused) return;                          // GEL en pause : le snapshot servi ne doit référencer que des
                                                // segments présents (sinon 404 sur back-seek). Sûr : disque statique.
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
    int delN = 0, delA = -1, delB = -1;
    for (NSNumber *n in idxs) {
      int idx = n.intValue;
      if (idx >= safeFloor) break;              // proche/devant la tête → ne plus rien purger
      BOOL behindWindow = idx < timeFloor;
      BOOL overCap = total > TVLR_DISK_CAP;
      if (!behindWindow && !overCap) break;     // dans la fenêtre ET sous le plafond → garder le reste
      NSString *p = [dir stringByAppendingPathComponent:[NSString stringWithFormat:@"seg%05d.m4s", idx]];
      if ([fm removeItemAtPath:p error:nil]) {
        total -= sizes[n].longLongValue;
        if (delA < 0) delA = idx;
        delB = idx; delN++;
      }
    }
    if (delN > 0)
      TVLOG("purge: del %d segs [%d..%d] head=%d floors(time=%d,safe=%d) avg=%.2fs disk=%lldMo",
            delN, delA, delB, headIdx, timeFloor, safeFloor, avgSeg, total / (1024 * 1024));
    gDiskBytes = total;
  }
}

// PHASE 2 FENÊTRÉE — pacing + purge par paquet écrit (extrait VERBATIM de la boucle moteur, budget
// 300 lignes). Bride la lecture anticipée : rester ~300 s devant la position de lecture (gTVPlayPos,
// poussée par JS) OU dès que le disque atteint le plafond (TVLR_DISK_CAP) → le remux d'un film 4K ne
// remplit plus le stockage. En parallèle on PURGE les segments derrière la tête (TVPurgeBehind).
// GATE gTVPlayPos>1 : ne pacer QU'APRÈS le démarrage réel — sinon une REPRISE (saut à T) se bloque
// (le remux séquentiel s'arrête au tampon sans jamais atteindre T → « recommence au début »).
// Tant que gTVPlayPos=0, le remux file librement. NB : gWrittenSec n'avance que via les paquets qui
// passent ICI (vidéo + audio copié) — l'audio TRANSCODÉ contourne la boucle, c'est voulu : la vidéo
// borne toujours la production.
static void TVPaceAndPurge(const char *dst, int gen, int64_t wpts, AVRational wtb, long long npkt) {
  if (wpts == AV_NOPTS_VALUE) return;
  // RELATIF au début de session : wpts est le PTS source ABSOLU (lu AVANT le shift make_zero appliqué
  // par le muxer), gSessionStartSec = origine réelle de la playlist (1ᵉʳ DTS muxé, cf. TVNoteFirstDts)
  // → writtenSec 0-based, ALIGNÉ sur gTVPlayPos (currentTime AVPlayer 0-based) et sur la timeline des
  // segments. SANS ça, gWrittenSec restait absolu (ex. 494) → gate `≥ PREBUFFER` vrai immédiatement
  // (pas de pré-buffer → stall de démarrage) ET pacing absolu vs relatif (famine).
  double writtenSec = (double)wpts * av_q2d(wtb) - gSessionStartSec;
  if (writtenSec < 0) writtenSec = 0;
  if (writtenSec > gWrittenSec) gWrittenSec = writtenSec;   // durée MAX produite (0-based) → gate pré-buffer + pacing
  if ((npkt % 120) == 0) TVPurgeBehind(dst, gen, gTVPlayPos);
  // Purge AUSSI pendant l'attente : quand la tête avance, gDiskBytes baisse et relâche le gate
  // octets (sinon deadlock — le gate ne se rouvrirait jamais sans purge).
  while (gReady && gTVPlayPos > 1.0 && gGen == gen && !gError &&
         (writtenSec > gTVPlayPos + 300.0 || gDiskBytes > TVLR_DISK_CAP)) {
    TVPurgeBehind(dst, gen, gTVPlayPos);
    usleep(200000);
  }
}
