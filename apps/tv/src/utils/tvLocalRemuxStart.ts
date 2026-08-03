import { NativeModules } from "react-native";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { plog } from "./playerDiag";

/**
 * Démarrage du remux local tvOS « façon Infuse » — décision d'éligibilité + start()
 * natif avec retries. Extrait de useTVStreamUrl.ios.ts (budget 300 lignes).
 * Android : le module natif est absent → remuxEligible renvoie false, tout est inerte.
 */

/** Résultat : URL locale + origine RÉELLE de la timeline (keyframe ≤ T, cf. TVNoteFirstDts
 *  natif — l'offset AVPlayerSurface devient exact) + jeton de session pour cancel(). */
export interface RemuxStart { url: string; actualStartSec: number; gen: number }

interface RemuxModule {
  start?: (u: string, dyn: number, aud: number, startSec: number, audOrdinal: number, audLang: string) =>
    Promise<string | { url?: string; startSec?: number; gen?: number }>;
  cancel?: (gen: number) => void;
}

/** Module natif TVLocalRemux (tvOS uniquement). */
export const TVRemux = (NativeModules as { TVLocalRemux?: RemuxModule }).TVLocalRemux;

/**
 * CHANTIER B — ne remuxer que si AVPlayer NE PEUT PAS faire de Direct Play NATIF (sinon
 * on matérialise un fichier sur disque pour rien : c'est l'« over-trigger 1080p »).
 * AVPlayer tvOS lit nativement : conteneurs MP4/M4V/MOV (PAS MKV/TS), HEVC hvc1 / H.264
 * avc1, audio AAC/AC3/EAC3/ALAC/FLAC/MP3/Opus, DV P5/P8 + HDR10/HLG. Murs tvOS → remux :
 *  (1) conteneur ≠ MP4/MOV/M4V (MKV/TS/AVI… : AVPlayer refuse le conteneur) ;
 *  (2) audio non décodable (DTS/DTS-HD/TrueHD/PCM/Vorbis… → le remux transcode en EAC3) ;
 *  (3) HDR/Dolby Vision : on GARDE le remux pour engager le badge via le HLS local +
 *      AVDisplayCriteria (AVPlayer ne bascule pas toujours la sortie HDMI sur un MP4
 *      progressif). hev1 est couvert par (1).
 * DV profil 7 (double couche, rips disque/UHD) = mur tvOS → PAS de remux, Jellyfin replie.
 */
export function remuxEligible(a: {
  container?: string;
  streams: JfStream[];
  audioIndex: number;
  vcodec?: string;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  burnInIndex: number;
}): boolean {
  const vstream = a.streams.find((s) => s.Type === "Video");
  const isDvP7 = vstream?.DvProfile === 7;
  const c = (a.container ?? "").toLowerCase();
  const nativeContainer = /\b(mp4|m4v|mov|qt)\b/.test(c);   // "mov,mp4,m4a,…" compte aussi
  const aud = a.streams.find((s) => s.Type === "Audio" && s.Index === a.audioIndex)
    ?? a.streams.find((s) => s.Type === "Audio");
  const acodec = (aud?.Codec ?? "").toLowerCase();
  const audioOk = acodec === "" || /^(aac|ac-?3|e-?ac-?3|ec-?3|alac|mp3|flac|opus)$/.test(acodec);
  const range = (vstream?.VideoRangeType ?? "").toUpperCase();
  const isHdrOrDv = (vstream?.DvProfile ?? 0) > 0 || /HDR|PQ|HLG|DOVI|DOLBY/.test(range);
  const needRemux = !nativeContainer || !audioOk || isHdrOrDv;
  return !a.forceTranscode && !a.isTranscodingQuality && a.burnInIndex < 0 && !isDvP7
    && !!TVRemux?.start && needRemux
    && (a.vcodec === "hevc" || a.vcodec === "h265" || a.vcodec === "h264");
}

/**
 * Lance (ou rejoint — arbitrage natif withinAvail) une session remux. 3 tentatives : le 1ᵉʳ
 * segment HLS peut être long (~10 s, coupé au keyframe) → start() peut timeouter au 1ᵉʳ play
 * à froid ; le 2ᵉ essai trouve la session chaude. On réessaie AVANT de retomber en transcode
 * (sinon on perd le HDR/DV). Accepte l'ancien résolveur string (transition natif) : l'origine
 * vaut alors le T demandé (comportement historique, précision GOP).
 */
export async function startLocalRemux(a: {
  rawUrl: string;
  streams: JfStream[];
  audioIndex: number;
  startSeconds: number;
  /** Le fetch parent a été supplanté (fetchId) : abandonner sans consommer le résultat. */
  isCancelled: () => boolean;
}): Promise<RemuxStart | null> {
  if (!TVRemux?.start) return null;
  // Plage dynamique AUTORITAIRE depuis Jellyfin (le natif ne lit pas la couleur si le MKV
  // n'a pas d'élément Colour) → badge correct. videoDynamicRange empirique tvOS 18 (vérifié
  // device) : Dolby Vision=3, HDR10/HLG=4, SDR=1 (force la redescente).
  const vstream = a.streams.find((s) => s.Type === "Video");
  const range = (vstream?.VideoRangeType ?? "").toUpperCase();
  const isDV = (vstream?.DvProfile ?? 0) > 0 || range.includes("DOVI") || range.includes("DOLBY");
  const dyn = isDV ? 3 : (range.includes("HDR") || range.includes("PQ") || range.includes("HLG")) ? 4 : 1;
  // Hints de SECOURS pour le natif : si MediaStream.Index ne résout pas une piste
  // AUDIO du fichier ouvert par FFmpeg (indexation divergente : pistes externes,
  // état initial), il retombe sur le n-ième flux audio puis sur la langue — au
  // lieu de la première piste du fichier en silence (mauvaise langue entendue).
  const audios = a.streams.filter((s) => s.Type === "Audio");
  const audioOrdinal = audios.findIndex((s) => s.Index === a.audioIndex);
  const audioLang = audios.find((s) => s.Index === a.audioIndex)?.Language ?? "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await TVRemux.start(a.rawUrl, dyn, a.audioIndex, Math.floor(a.startSeconds), audioOrdinal, audioLang);
      if (a.isCancelled()) return null;
      if (typeof res === "string") {
        return res ? { url: res, actualStartSec: Math.floor(a.startSeconds), gen: 0 } : null;
      }
      if (res?.url) {
        return {
          url: res.url,
          actualStartSec: Math.max(0, res.startSec ?? Math.floor(a.startSeconds)),
          gen: res.gen ?? 0,
        };
      }
    } catch (e) {
      plog("remux", `start() tentative ${attempt + 1}/3 échouée : ${(e as { code?: string; message?: string })?.code ?? ""} ${(e as { message?: string })?.message ?? String(e)}`);
      if (a.isCancelled()) return null;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600));
    }
  }
  return null;   // tous les essais ont échoué → le caller replie sur PlaybackInfo
}
