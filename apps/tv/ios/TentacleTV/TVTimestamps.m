//
//  TVTimestamps.m  (tvOS / Apple TV) — hygiène des timestamps du chemin COPIE du
//  remux « façon Infuse ». Le transcode audio a sa compensation de dérive
//  (TVAudioTranscode.m) ; le chemin copie n'avait RIEN : un recul de timestamps
//  source (overlap/duplicate) était écrasé par un clamp DTS « +1 » aveugle (burst
//  de samples à durée ~nulle → désync A/V permanente), un trou passait inaperçu.
//  Phase 1 : OBSERVER (logs) sans changer le comportement — le clamp historique
//  de TVRemuxEngine reste appliqué à l'identique. Les seuils vivent dans
//  TVCommon.h (TVLR_TSLOG_GAP_MS / TVLR_COPY_BACK_MAX_MS).
//  #importé par TVLocalRemux.m (unity build) — DOIT précéder TVRemuxEngine.m.
//

#import "TVCommon.h"

// État d'hygiène par piste : copiée (audio) ou observée (vidéo).
typedef struct {
  int64_t lastDts;               // audio : dernier DTS écrit · vidéo : plus haut PTS vu (time_base sortie)
  int64_t lastDur;               // durée du paquet correspondant
  long long nClamp, nDrop, nGap; // compteurs de session (log de synthèse en fin de remux)
  int clampRun;                  // clamps consécutifs en cours (log par run, anti-spam)
} TVTsTrack;

#define TV_TS_INIT { INT64_MIN, 0, 0, 0, 0, 0 }

// AUDIO COPIÉ — remplace le site du clamp historique de la boucle moteur.
// Log des reculs (dts ≤ last) et des trous (> TVLR_TSLOG_GAP_MS), puis clamp
// monotone IDENTIQUE à l'existant (dts ≤ last → last+1 ; PTS jamais touchés).
// Retour : 0 = écrire le paquet, 1 = le dropper (correctif recul, phase 5).
static int TVCopyTsRepair(TVTsTrack *t, AVPacket *pkt, AVRational tb, int oidx) {
  if (pkt->dts == AV_NOPTS_VALUE) return 0;   // comportement historique : ni clamp ni mise à jour
  double ms = av_q2d(tb) * 1000.0;
  if (t->lastDts != INT64_MIN) {
    if (pkt->dts <= t->lastDts) {             // recul / duplicate source
      double backMs = (double)(t->lastDts - pkt->dts) * ms;
      t->nClamp++;
      if (++t->clampRun == 1)
        TVLOG("ts-copy[out=%d]: recul %.0f ms (dts=%lld <= last=%lld) -> clamp",
              oidx, backMs, (long long)pkt->dts, (long long)t->lastDts);
      pkt->dts = t->lastDts + 1;              // clamp historique (P5 : drop borné au-delà du seuil)
    } else {
      if (t->clampRun > 1)
        TVLOG("ts-copy[out=%d]: fin de run — %d clamps consecutifs (total=%lld)",
              oidx, t->clampRun, t->nClamp);
      t->clampRun = 0;
      int64_t ref = t->lastDts + (t->lastDur > 0 ? t->lastDur : 1);
      double gapMs = (double)(pkt->dts - ref) * ms;
      if (gapMs > TVLR_TSLOG_GAP_MS) {        // trou source (silence non encodé, edit, corruption)
        t->nGap++;
        TVLOG("ts-copy[out=%d]: trou +%.0f ms (dts %lld -> %lld, trou n.%lld)",
              oidx, gapMs, (long long)t->lastDts, (long long)pkt->dts, t->nGap);
      }
    }
  }
  t->lastDts = pkt->dts;
  t->lastDur = pkt->duration;
  return 0;
}

// VIDÉO — observation SEULE (aucune modification de paquet) : les PTS d'affichage
// reculent naturellement de quelques frames (B-frames réordonnées) → seuils larges
// pour ne capter que les vraies anomalies source, au-delà du réordonnancement.
static void TVVideoTsLog(TVTsTrack *t, int64_t pts, int64_t dur, AVRational tb, int oidx) {
  if (pts == AV_NOPTS_VALUE) return;
  if (t->lastDts == INT64_MIN) { t->lastDts = pts; t->lastDur = dur; return; }
  double ms = av_q2d(tb) * 1000.0;
  if (pts > t->lastDts) {
    double gapMs = (double)(pts - t->lastDts - (t->lastDur > 0 ? t->lastDur : 1)) * ms;
    if (gapMs > TVLR_TSLOG_GAP_MS + 300.0) {  // marge : l'ordre d'affichage n'est pas linéaire (P devant B)
      t->nGap++;
      TVLOG("ts-video[out=%d]: saut PTS +%.0f ms (max %lld -> %lld, saut n.%lld)",
            oidx, gapMs, (long long)t->lastDts, (long long)pts, t->nGap);
    }
    t->lastDts = pts; t->lastDur = dur;
  } else {
    double backMs = (double)(t->lastDts - pts) * ms;
    if (backMs > 500.0)                       // > fenêtre de réordonnancement B-frames (~8 frames)
      TVLOG("ts-video[out=%d]: recul PTS -%.0f ms (%lld < max %lld)",
            oidx, backMs, (long long)pts, (long long)t->lastDts);
  }
}
