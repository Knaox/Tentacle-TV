//
//  TVCommon.h  (tvOS / Apple TV) — en-tête commun du lecteur « façon Infuse »
//  Imports FFmpeg/os.log/GCDWebServer partagés, macros, helpers et déclarations
//  extern des globals de session. INCLUS UNE SEULE FOIS (unity build) : les .m du
//  module sont #importés dans TVLocalRemux.m → une seule unité de traduction.
//

#ifndef TVCOMMON_H
#define TVCOMMON_H

#import <React/RCTBridgeModule.h>
#import <GCDWebServer/GCDWebServer.h>
#import <GCDWebServer/GCDWebServerStreamedResponse.h>
#import <GCDWebServer/GCDWebServerRequest.h>
#import <GCDWebServer/GCDWebServerFileResponse.h>
#import <GCDWebServer/GCDWebServerDataResponse.h>
#import <libavformat/avformat.h>
#import <libavutil/avutil.h>
#import <libavcodec/avcodec.h>
#import <libavcodec/bsf.h>   // extract_extradata (extradata in-band absente : TS, MKV sans CodecPrivate)
#import <libavutil/dovi_meta.h>
#import <libswresample/swresample.h>
#import <libavutil/audio_fifo.h>
#import <libavutil/channel_layout.h>
#import <libavutil/samplefmt.h>
#import <os/log.h>
#include <float.h>   // DBL_MAX (init de gTVMinFirstDts avant la 1ʳᵉ écriture)

#define TVLOG(fmt, ...) os_log_error(OS_LOG_DEFAULT, "[TVLR] " fmt, ##__VA_ARGS__)
#define TVLR_REORDER 8   // profondeur de réordonnancement B-frames couverte (HEVC grand public ≤ 4-8)
// Fenêtrage disque (TVWindow.m) : plafond DUR (octets) + marge conservée DERRIÈRE la tête.
#define TVLR_DISK_CAP   (1600LL * 1024 * 1024)   // 1,6 Go → tient sur Apple TV 32/64 Go quel que soit le film
#define TVLR_BEHIND_SEC 60.0                      // ~1 min conservée derrière la tête (petits retours arrière OK)
#define TVLR_PREBUFFER_SEC 8.0                    // s produites (0-based) avant de résoudre start() → cushion anti-stall de démarrage
#define TVLR_RESUME_PREBUFFER_SEC 3.0             // cushion réduit pour une session de REPRISE/seek (gResumePending) → start() résout en ~2-3 s
// Compensation de dérive A/V du transcode audio (TVAudioTranscode.m) : au-delà de 100 ms d'écart
// entre le PTS source et la timeline reconstituée (compteur d'échantillons), on comble (silence)
// ou on rogne (trim) — équivalent manuel de `aresample=async=1:min_hard_comp=0.1` du CLI ffmpeg.
#define TVLR_ADRIFT_MIN_SAMPLES 4800              // 100 ms @48 kHz : seuil de correction dure
#define TVLR_ADRIFT_MAX_SAMPLES (30LL * 48000)    // > 30 s = saut de PTS pathologique → log + ignore (pas 30 s de silence)

// Route les logs internes de FFmpeg vers Console.app (raison exacte des échecs).
static void TVAvLog(void *avcl, int level, const char *fmt, va_list vl) {
  if (level > AV_LOG_WARNING) return;
  char line[512];
  vsnprintf(line, sizeof(line), fmt, vl);
  os_log_error(OS_LOG_DEFAULT, "[TVLR-ff] %{public}s", line);
}

static long long TVFileSize(NSString *path) {
  NSDictionary *a = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:nil];
  return a ? (long long)[a fileSize] : 0;
}

static const char *TVErr(int ret) {
  static char buf[256]; av_strerror(ret, buf, sizeof(buf)); return buf;
}

// ===== Globals de session (DÉFINIS dans TVRemuxEngine.m, un seul endroit) =====
extern GCDWebServer *gServer;
extern NSString     *gOutPath;
extern long long     gTotalEstimate;
extern volatile int  gDone;
extern volatile int  gError;
extern volatile int  gReady;   // 1 dès que la playlist liste un 1ᵉʳ segment
extern volatile int  gGen;     // génération de session : un nouveau start() annule le remux précédent
extern volatile double gTVPlayPos;  // position de lecture (s) reçue de JS → bride la lecture anticipée
extern dispatch_queue_t gRemuxQueue;
extern NSString     *gCurrentSource;
extern NSString     *gCurrentUrl;
// Plage dynamique + fps détectés par le remux, lus par TVDisplayCriteria pour engager le
// badge HDR/DV via AVDisplayCriteria (API privée, comme Kodi). 0=SDR, 3=HDR10, 4=Dolby Vision.
extern int    gTVDynRange;
extern double gTVFps;
extern volatile int gWantAudioIdx;  // index de piste audio (MediaStream.Index JS) à mapper ; -1 = 1ʳᵉ dispo
extern volatile int    gWantStartSec; // position de reprise (s) demandée par JS
extern volatile double gWrittenSec;   // position max ÉCRITE par le remux (s) → gate de reprise
extern volatile long long gDiskBytes; // octets cumulés des segments (fenêtrage disque, TVWindow.m)
extern volatile double gSessionStartSec; // temps ABSOLU du 1ᵉʳ segment de la session (av_seek_frame) → mapping purge/headIdx
// Départ RÉEL de session : `avoid_negative_ts=make_zero` rebase la playlist sur le PREMIER DTS muxé
// (keyframe ≤ T, moins l'amorce B-frames), pas sur le T demandé — l'écart peut atteindre un GOP.
// On capture le min des premiers DTS écrits par flux → gSessionStartSec devient EXACT (offset JS,
// fenêtre withinAvail, purge, pacing). Définis dans TVRemuxEngine.m, reset à chaque session.
extern volatile double   gTVMinFirstDts;   // min des 1ᵉʳˢ DTS écrits (s, absolu source) ; DBL_MAX avant 1ʳᵉ écriture
extern volatile uint32_t gTVFirstSeenMask; // bit par flux de sortie : 1ᵉʳ paquet déjà noté
// ===== Vraie pause permanente (anti -11866) — DÉFINIS dans TVWindow.m =====
extern volatile int gPaused;        // 1 = lecteur en pause → le handler réécrit le manifeste servi (cf. TVBuildPausedManifest)
extern volatile int gResumePending; // one-shot : la reprise après pause longue (mode VOD) force une NOUVELLE session à P (saute withinAvail)
extern volatile int gSnapshotMode;  // 0 = keepalive EVENT (variante A) · 1 = VOD+ENDLIST (variante B) — arbitré par le spike device

// Note le PREMIER DTS écrit d'un flux de sortie (appelé aux DEUX sites d'écriture : boucle moteur
// + TVAudioEncodeFifo, l'audio transcodé contournant la boucle). Le min courant devient l'origine
// de la timeline playlist (clampé ≥ 0 : un départ à 0 amorce le DTS vidéo en négatif).
static inline void TVNoteFirstDts(int oidx, int64_t dts, AVRational tb) {
  if (dts == AV_NOPTS_VALUE || oidx < 0 || oidx > 30) return;
  uint32_t bit = (uint32_t)1u << oidx;
  if (gTVFirstSeenMask & bit) return;
  gTVFirstSeenMask |= bit;
  double sec = (double)dts * av_q2d(tb);
  if (sec < gTVMinFirstDts) gTVMinFirstDts = sec;
  gSessionStartSec = gTVMinFirstDts < 0 ? 0 : gTVMinFirstDts;
}

// ===== Mapping des flux (TVStreamMap.m) : sorties de TVMapStreams =====
typedef struct {
  int vInIdx, vOutIdx;                    // indices vidéo (entrée/sortie) ; -1 si absent
  int v_dvp, v_blcompat, v_dvlevel;       // Dolby Vision (profil / compat / level) pour le master
  int v_w, v_h;                           // résolution (master playlist)
  const char *a_codec;                    // CODECS audio du master (NULL si aucun audio)
  AVCodecContext *adec, *aenc;            // transcode audio on-device (NULL si copie)
  SwrContext *aswr; AVAudioFifo *afifo;
  int aXcode, aOutIdx;                    // 1 si transcode actif + index de sortie audio
  AVRational aInTb;                       // time_base du flux audio source (ancrage PTS)
  int oi;                                 // nombre de flux de sortie mappés
} TVMapOut;

// Réécrit le manifeste `index.m3u8` à servir PENDANT la pause (FFmpeg continue d'écrire l'EVENT brut sur disque).
// eventPath = chemin du index.m3u8 EVENT ; dir = dossier de session (existence des segments). Retourne une NSString
// autoreleased, ou nil pour servir le fichier brut. Mode A : EVENT + commentaire changeant (jamais « inchangé »).
// Mode B : snapshot VOD (TYPE:VOD + ENDLIST, front purgé rogné). #importé par TVLocalRemux.m (même unité).
NSString *TVBuildPausedManifest(NSString *eventPath, NSString *dir);

#endif /* TVCOMMON_H */
