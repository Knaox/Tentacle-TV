import { useRef, useState, useEffect, useCallback, type MutableRefObject } from "react";
import type { SkipFlash } from "../components/SkipBadge";
import { observerSaut, SAUT_VIDE, PERIODE_VEILLE_SAUT_MS } from "./calageSaut";

interface UseSmartSeekOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  containerPtsOffsetRef: MutableRefObject<number>;
  seekTargetRef: MutableRefObject<number | null>;
  /** Veille de calage du saut — un INTERVALLE, cf. `calageSaut.ts`. */
  seekStallTimer: MutableRefObject<ReturnType<typeof setInterval> | undefined>;
  currentTimeRef: MutableRefObject<number>;
  src: string;
  isDirectPlay: boolean;
  streamOffset: number;
  onSeekRequest?: (seconds: number) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
}

/** Check if a time (in PTS space) falls within any buffered range of the video element. */
function isTimeInBuffered(video: HTMLVideoElement, time: number): boolean {
  for (let i = 0; i < video.buffered.length; i++) {
    if (time >= video.buffered.start(i) && time <= video.buffered.end(i)) {
      return true;
    }
  }
  return false;
}

/**
 * Fin de la plage `buffered` la plus avancée, `null` s'il n'y en a aucune.
 *
 * La seule borne de `buffered` qui veuille dire quelque chose sur la pile média
 * du téléviseur — cf. `calageSaut.ts`, le début vaut toujours zéro.
 */
function finTampon(video: HTMLVideoElement): number | null {
  const n = video.buffered.length;
  return n > 0 ? video.buffered.end(n - 1) : null;
}

export function useSmartSeek({
  videoRef, containerPtsOffsetRef, seekTargetRef, seekStallTimer, currentTimeRef,
  src, isDirectPlay, streamOffset, onSeekRequest, onSeekComplete,
}: UseSmartSeekOptions) {
  // 3-level smart seek — handles direct play, HLS, and progressive transcode streams.
  //
  // All targets from PlayerControls are in "movie position" (0 to duration).
  // CopyTimestamps streams have a container PTS offset — v.currentTime and v.buffered
  // are in PTS space (offset + movie_position). containerPtsOffsetRef bridges this gap.
  //
  /**
   * Arme la veille qui dira si ce saut a produit quelque chose.
   *
   * Périodique, et non un minuteur unique : un saut qui aboutit doit être
   * reconnu tout de suite, pas huit secondes plus tard. La décision est dans
   * `calageSaut.ts` — pure, testée, et documentée sur ce que `buffered` vaut
   * réellement ici.
   */
  const armerVeille = useCallback((ptsTarget: number, clamped: number) => {
    clearInterval(seekStallTimer.current);
    const arme = Date.now();
    let etat = SAUT_VIDE;
    seekStallTimer.current = setInterval(() => {
      const el = videoRef.current;
      if (!el) {
        clearInterval(seekStallTimer.current);
        return;
      }
      const [suivant, verdict] = observerSaut(etat, {
        cible: ptsTarget,
        position: el.currentTime,
        bufferFin: finTampon(el),
        enPause: el.paused,
        pret: el.readyState,
        ecoule: Date.now() - arme,
      });
      etat = suivant;
      if (verdict === "attendre") return;
      clearInterval(seekStallTimer.current);
      if (verdict === "renegocier") {
        console.warn("[Tentacle:Seek] saut sans effet — session neuve", { cible: Math.round(clamped) });
        seekTargetRef.current = clamped;
        onSeekRequest?.(clamped);
      }
    }, PERIODE_VEILLE_SAUT_MS);
  }, [onSeekRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level 1: target in HTML5 buffer → v.currentTime (instant)
  // Level 2: HLS/Direct Play → v.currentTime, hls.js fetches segment (fast, ~1-2s)
  //          with stall watcher (cf. `calageSaut.ts`) → fallback to level 3
  // Level 3: full restart → tuer l'encodage et renégocier une session à la
  //          position voulue (lent, 3-5 s). Le nom d'antan — « rebuild URL with
  //          StartTimeTicks » — décrivait un remède impossible : sur le chemin
  //          HLS, AUCUNE URL ne peut porter la position. La playlist de Jellyfin
  //          commence toujours au segment 0 (elle est bâtie sur la durée totale),
  //          et son gestionnaire de segments refuse tout `StartTimeTicks` non
  //          nul. Ce qui déplace vraiment la lecture est le nouveau POST
  //          `PlaybackInfo` déclenché par `onSeekRequest`.
  const handleSeek = useCallback((targetSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const isHlsStream = src.includes(".m3u8");
    const ptsOffset = containerPtsOffsetRef.current;

    // Cancel any pending stall watcher from a previous seek
    clearInterval(seekStallTimer.current);

    // Clamp to valid movie-position range.
    // For progressive transcode, v.duration is stream-relative (movieDuration - streamOffset).
    const isProgressiveTranscode = !isHlsStream && !isDirectPlay && streamOffset > 0;
    const movieMax = isProgressiveTranscode
      ? (v.duration || Infinity) + streamOffset
      : (v.duration || Infinity);
    const clamped = Math.max(0, Math.min(targetSeconds, movieMax));

    // Convert movie position to video-element PTS time
    const ptsTarget = clamped + ptsOffset;

    // --- LEVEL 1: Target in HTML5 buffer → instant seek ---
    if (isTimeInBuffered(v, ptsTarget)) {
      v.currentTime = ptsTarget;
      onSeekComplete?.(clamped, v.paused);
      // La veille est armée ICI AUSSI, et ce n'est pas de la prudence de trop :
      // la pile média du téléviseur rend toujours une plage `buffered` unique
      // partant de zéro, si bien que TOUT saut en arrière du film tombe dans ce
      // niveau — données réellement en mémoire ou non. C'était le chemin le plus
      // emprunté, et le seul à n'avoir jamais eu de filet.
      if (isHlsStream) armerVeille(ptsTarget, clamped);
      return;
    }

    // Direct play: HTTP Range requests support random seek — always works
    if (isDirectPlay) {
      v.currentTime = ptsTarget;
      onSeekComplete?.(clamped, v.paused);
      return;
    }

    // --- LEVEL 2: HLS → try v.currentTime, hls.js fetches the segment ---
    // jellyfin-web pattern (playbackmanager.js:canPlayerSeek): HLS streams are
    // client-seekable — hls.js requests segments on demand. The existing ffmpeg
    // keeps running and serves segments as long as they've been transcoded.
    // If ffmpeg has advanced past this position (readrate=10x), the segment
    // already exists on disk and hls.js fetches it quickly.
    if (isHlsStream) {
      v.currentTime = ptsTarget;
      onSeekComplete?.(clamped, v.paused);
      armerVeille(ptsTarget, clamped);
      return;
    }

    // --- Progressive transcode: always full restart (level 3) ---
    // No in-stream seek support — must rebuild URL with new StartTimeTicks.
    seekTargetRef.current = clamped;
    onSeekRequest?.(clamped);
  }, [isDirectPlay, streamOffset, src, onSeekRequest, onSeekComplete, armerVeille]);

  // Badge « +30s / −10s » à chaque saut (boutons, flèches clavier, swipe)
  const [skipFlash, setSkipFlash] = useState<SkipFlash | null>(null);
  const skipFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(skipFlashTimer.current), []);
  const skipBy = useCallback((delta: number) => {
    handleSeek(Math.max(0, currentTimeRef.current + delta));
    setSkipFlash({ delta, id: Date.now() });
    clearTimeout(skipFlashTimer.current);
    skipFlashTimer.current = setTimeout(() => setSkipFlash(null), 1000);
  }, [handleSeek]);

  return { handleSeek, skipBy, skipFlash };
}
