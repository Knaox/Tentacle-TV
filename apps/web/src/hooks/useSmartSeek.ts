import { useRef, useState, useEffect, useCallback, type MutableRefObject } from "react";
import type { SkipFlash } from "../components/SkipBadge";
import { observeSeek, EMPTY_SEEK, SEEK_WATCH_PERIOD_MS } from "./seekLanding";

interface UseSmartSeekOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  containerPtsOffsetRef: MutableRefObject<number>;
  seekTargetRef: MutableRefObject<number | null>;
  /** Veille de calage du saut — un INTERVALLE, cf. `seekLanding.ts`. */
  seekStallTimer: MutableRefObject<ReturnType<typeof setInterval> | undefined>;
  currentTimeRef: MutableRefObject<number>;
  src: string;
  isDirectPlay: boolean;
  streamOffset: number;
  onSeekRequest?: (seconds: number) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  /**
   * Dire — ou cesser de dire — que le déplacement charge encore.
   *
   * Facultatif : un appelant qui ne le passe pas garde le comportement d'avant,
   * ce qui laisse le lecteur du bureau et ses propres filets hors de portée.
   * Câblé sur le `loading` du lecteur, il allume LE spinner qui existe déjà —
   * on n'en ajoute pas un second, c'est précisément ce qui avait dû être retiré.
   */
  reportLoading?: (charge: boolean) => void;
  /**
   * Un saut qui vise LA FIN — ou au-delà. Facultatif : sans lui, l'ancien
   * clamp s'applique. Voir la garde en tête de `handleSeek`.
   */
  onSeekToEnd?: () => void;
}

/**
 * En deçà d'une demi-seconde du bord, un saut « vers la fin » EST la fin :
 * ces derniers dixièmes n'ont rien à montrer, et les durées déclarées
 * (conteneur, contrat Jellyfin) divergent entre elles de cet ordre-là.
 * Partagée avec le lecteur de bureau — une seule définition du « bord ».
 */
export const SEEK_END_EPS_S = 0.5;

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
 * du téléviseur — cf. `seekLanding.ts`, le début vaut toujours zéro.
 */
function bufferEnd(video: HTMLVideoElement): number | null {
  const n = video.buffered.length;
  return n > 0 ? video.buffered.end(n - 1) : null;
}

export function useSmartSeek({
  videoRef, containerPtsOffsetRef, seekTargetRef, seekStallTimer, currentTimeRef,
  src, isDirectPlay, streamOffset, onSeekRequest, onSeekComplete, reportLoading, onSeekToEnd,
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
   * `seekLanding.ts` — pure, testée, et documentée sur ce que `buffered` vaut
   * réellement ici.
   */
  const armWatch = useCallback((ptsTarget: number, clamped: number) => {
    clearInterval(seekStallTimer.current);
    const armed = Date.now();
    let state = EMPTY_SEEK;
    // On n'éteint que ce qu'on a allumé : `loading` sert AUSSI au chargement
    // initial de la source, qui le tient jusqu'à la première image. L'éteindre
    // parce qu'un saut a abouti laisserait un écran noir sans rien dire.
    let lit = false;
    seekStallTimer.current = setInterval(() => {
      const el = videoRef.current;
      if (!el) {
        clearInterval(seekStallTimer.current);
        return;
      }
      const [next, verdict] = observeSeek(state, {
        target: ptsTarget,
        position: el.currentTime,
        bufferEnd: bufferEnd(el),
        paused: el.paused,
        ready: el.readyState,
        elapsed: Date.now() - armed,
      });
      state = next;
      if (verdict === "wait") return;

      // Le seul verdict qui n'arrête pas la veille : il DIT, il n'agit pas, et
      // le saut peut encore aboutir de lui-même au relevé suivant.
      if (verdict === "loading") {
        lit = true;
        reportLoading?.(true);
        return;
      }

      clearInterval(seekStallTimer.current);
      if (lit) reportLoading?.(false);
      if (verdict === "renegotiate") {
        console.warn("[Tentacle:Seek] saut sans effet — session neuve", { target: Math.round(clamped) });
        seekTargetRef.current = clamped;
        onSeekRequest?.(clamped);
      }
    }, SEEK_WATCH_PERIOD_MS);
  }, [onSeekRequest, reportLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level 1: target in HTML5 buffer → v.currentTime (instant)
  // Level 2: HLS/Direct Play → v.currentTime, hls.js fetches segment (fast, ~1-2s)
  //          with stall watcher (cf. `seekLanding.ts`) → fallback to level 3
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

    // Un saut qui vise la fin — ou au-delà — TERMINE la lecture, il ne se
    // clampe pas à quelques dixièmes du bord : l'affiche de fin doit au geste
    // manuel ce qu'elle doit à l'EOF naturel. L'élément est tout de même posé
    // sur sa fin (les rapports de progression diront ~100 %, l'épisode sera
    // « vu »), mais la fin de lecture n'attend PAS son événement `ended` : un
    // flux HLS peut ne jamais le tirer sur son dernier fragment.
    if (onSeekToEnd && Number.isFinite(movieMax) && targetSeconds >= movieMax - SEEK_END_EPS_S) {
      if (Number.isFinite(v.duration)) v.currentTime = v.duration;
      // Watch Together : la salle saute à la fin elle aussi — chaque membre
      // refera cette même détection en recevant la position.
      onSeekComplete?.(movieMax, v.paused);
      onSeekToEnd();
      return;
    }
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
      if (isHlsStream) armWatch(ptsTarget, clamped);
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
      armWatch(ptsTarget, clamped);
      return;
    }

    // --- Progressive transcode: always full restart (level 3) ---
    // No in-stream seek support — must rebuild URL with new StartTimeTicks.
    seekTargetRef.current = clamped;
    onSeekRequest?.(clamped);
  }, [isDirectPlay, streamOffset, src, onSeekRequest, onSeekComplete, onSeekToEnd, armWatch]);

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
