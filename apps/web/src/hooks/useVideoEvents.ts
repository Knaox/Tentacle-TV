import { useMemo, type MutableRefObject, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { markPlayerExit } from "../components/detail/detailTransition";
import { wtLog } from "../watchTogether/wtLog";
import { DELAI_CHARGEMENT_MS } from "./seekLanding";
import { fractionChargee } from "./bufferedProgress";

const DBG = "[Tentacle:VideoPlayer]";

interface UseVideoEventsArgs {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  rawTimeRef: MutableRefObject<number>;
  lastKnownPositionRef: MutableRefObject<number>;
  effectiveOffsetRef: MutableRefObject<number>;
  containerPtsOffsetRef: MutableRefObject<number>;
  offsetDetectedRef: MutableRefObject<boolean>;
  sourceChangingRef: MutableRefObject<boolean>;
  hasStartedRef: MutableRefObject<boolean>;
  waitingTimer: MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  src: string;
  itemId: string;
  startPositionSeconds?: number;
  jellyfinDuration?: number;
  autoplayNextEnabled: boolean;
  hasNextEpisode?: boolean;
  autoPlayCountdown: number | null;
  setPlaying: (v: boolean) => void;
  /** Pendant réactif de `hasStartedRef` — cf. VideoPlayer. */
  setADemarre: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setShowPlayButton: (v: boolean) => void;
  setBuffered: (v: number) => void;
  setVideoDuration: (v: number) => void;
  startAutoPlay: () => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onStarted?: () => void;
  onPlayStateChange?: (paused: boolean) => void;
  onBufferingChange?: (buffering: boolean) => void;
  onFatalError?: () => void;
}

/**
 * Handlers de l'élément `<video>` du player web : détection du PTS offset,
 * report de progression, transitions lecture/pause/buffering (avec signaux
 * Watch Together), erreurs fatales et fin de lecture. Extraction mécanique de
 * VideoPlayer — le shell étale l'objet retourné sur `<video {...handlers}>`.
 */
export function useVideoEvents(a: UseVideoEventsArgs) {
  const navigate = useNavigate();

  return useMemo(() => ({
    onTimeUpdate: (e: SyntheticEvent<HTMLVideoElement>) => {
      const t = e.currentTarget.currentTime;
      a.rawTimeRef.current = t;
      // Detect container PTS offset on first timeupdate.
      // CopyTimestamps=true preserves the original container's PTS base, which
      // may be non-zero (e.g., 677s for broadcast recordings). Subtract it
      // so displayed time shows movie position (0 to duration), not raw PTS.
      if (!a.offsetDetectedRef.current && t > 0) {
        a.offsetDetectedRef.current = true;
        const expectedStart = a.startPositionSeconds || 0;
        const detectedOffset = t - expectedStart;
        // Significant offset (> 5s) = real container PTS base, not timing jitter
        if (detectedOffset > 5) {
          a.containerPtsOffsetRef.current = Math.round(detectedOffset);
          a.effectiveOffsetRef.current = -a.containerPtsOffsetRef.current;
        }
      }
      const absoluteTime = a.effectiveOffsetRef.current + t;
      a.lastKnownPositionRef.current = absoluteTime;
      if (!a.sourceChangingRef.current) a.onProgress?.(absoluteTime, e.currentTarget.paused);
    },
    onProgress: () => {
      const v = a.videoRef.current;
      if (!v) return;
      // Use jellyfinDuration for HLS event playlists where v.duration is Infinity
      const dur = a.jellyfinDuration && a.jellyfinDuration > 0 ? a.jellyfinDuration : v.duration;
      const plages = [];
      for (let i = 0; i < v.buffered.length; i++) {
        plages.push({ debut: v.buffered.start(i), fin: v.buffered.end(i) });
      }
      // La décision est dans `bufferedProgress.ts` : elle retranche le décalage
      // d'horodatage du conteneur, que cette boucle-ci oubliait, et documente ce
      // que `buffered` vaut réellement selon le lecteur — sur la pile média du
      // téléviseur, une plage unique partant toujours de zéro.
      const fraction = fractionChargee(plages, v.currentTime, dur, a.containerPtsOffsetRef.current);
      if (fraction !== null) a.setBuffered(fraction);
    },
    onLoadedMetadata: (e: SyntheticEvent<HTMLVideoElement>) => {
      a.setVideoDuration(e.currentTarget.duration);
    },
    onPlay: () => {
      wtLog("web-video", "event play", { pos: a.lastKnownPositionRef.current.toFixed(1) });
      a.sourceChangingRef.current = false;
      a.setPlaying(true); a.setLoading(false); a.setShowPlayButton(false);
      if (!a.hasStartedRef.current) {
        a.hasStartedRef.current = true; a.setADemarre(true); a.onStarted?.();
      }
      a.onPlayStateChange?.(false);
    },
    onPause: () => {
      wtLog("web-video", "event pause", { pos: a.lastKnownPositionRef.current.toFixed(1) });
      a.setPlaying(false); a.onPlayStateChange?.(true);
    },
    onWaiting: () => {
      clearTimeout(a.waitingTimer.current);
      a.waitingTimer.current = setTimeout(() => {
        wtLog("web-video", `waiting > ${DELAI_CHARGEMENT_MS}ms → signal buffering=true`, {
          pos: a.lastKnownPositionRef.current.toFixed(1),
          readyState: a.videoRef.current?.readyState,
        });
        a.setLoading(true); a.onBufferingChange?.(true);
      }, DELAI_CHARGEMENT_MS);
    },
    // `seeked` et `playing` n'ont plus le droit de désarmer la veille de calage :
    // tous deux sont émis dès que le lecteur a FINI de se déplacer, ce qui ne dit
    // rien de l'arrivée des données à la cible. Sur la pile média native ils
    // partent bien avant le premier segment, si bien que le niveau 3 de
    // `useSmartSeek` ne pouvait jamais jouer. C'est `observerSaut` qui conclut
    // désormais, et lui seul arrête sa veille (cf. `seekLanding.ts`).
    onSeeked: () => {
      wtLog("web-video", "event seeked", { pos: a.videoRef.current?.currentTime.toFixed(1) });
    },
    onPlaying: () => {
      wtLog("web-video", "event playing → signal buffering=false", { pos: a.lastKnownPositionRef.current.toFixed(1) });
      clearTimeout(a.waitingTimer.current);
      if (!a.sourceChangingRef.current) a.setLoading(false);
      a.onBufferingChange?.(false);
    },
    onCanPlay: () => {
      clearTimeout(a.waitingTimer.current);
      if (!a.sourceChangingRef.current) a.setLoading(false);
    },
    onCanPlayThrough: () => {
      // « Prêt » pour le groupe SEULEMENT ici (pas à canplay) : le buffer
      // gate du player attend canplaythrough avant de lancer la lecture —
      // signaler plus tôt ferait repartir le groupe pendant qu'un rebuild
      // transcode charge encore (désync). Émis aussi en pause (group-wait).
      wtLog("web-video", "event canplaythrough → signal buffering=false", { pos: a.lastKnownPositionRef.current.toFixed(1) });
      a.onBufferingChange?.(false);
    },
    onStalled: () => {
      // HTML5 `stalled` fires frequently during HLS playback (segment switch,
      // network jitter, paused tab) even when playback recovers immediately.
      // Demoted to console.debug so it stays out of the default console output
      // — set DevTools log level to "Verbose" to see it during deep debugging.
      console.debug(DBG, "video stalled", { src: a.src.slice(0, 120), readyState: a.videoRef.current?.readyState, networkState: a.videoRef.current?.networkState });
    },
    onError: (e: SyntheticEvent<HTMLVideoElement>) => {
      const err = e.currentTarget.error;
      console.error(DBG, "video error", { code: err?.code, message: err?.message, src: a.src.slice(0, 120), networkState: e.currentTarget.networkState });
      wtLog("web-video", "event ERROR", { code: err?.code, message: err?.message });
      // MEDIA_ERR_DECODE / MEDIA_ERR_SRC_NOT_SUPPORTED : ce client ne peut
      // pas lire ce média (Watch Together : ne pas geler le groupe).
      if (err && (err.code === 3 || err.code === 4)) a.onFatalError?.();
      // Échec PENDANT le chargement : rendre la main tout de suite. Aucun
      // événement ne viendra plus de cet élément, et laisser tourner le spinner
      // jusqu'aux 15 s du failsafe — voire indéfiniment si un repli l'a
      // désarmé — donnait un écran noir muet, sans rien à quoi se raccrocher.
      // En lecture établie on ne touche à rien : hls.js sait se remettre d'une
      // erreur réseau passagère, et un bouton de lecture surgi en plein film
      // serait un remède pire que le mal.
      if (a.sourceChangingRef.current) {
        a.sourceChangingRef.current = false;
        a.setLoading(false);
        a.setShowPlayButton(true);
      }
    },
    onEnded: () => {
      if (a.autoplayNextEnabled && a.hasNextEpisode && a.autoPlayCountdown === null) a.startAutoPlay();
      else if (!a.hasNextEpisode || !a.autoplayNextEnabled) { markPlayerExit(); navigate(`/media/${a.itemId}`, { replace: true }); }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [a.src, a.itemId, a.startPositionSeconds, a.jellyfinDuration, a.autoplayNextEnabled, a.hasNextEpisode, a.autoPlayCountdown, a.startAutoPlay, a.onProgress, a.onStarted, a.onPlayStateChange, a.onBufferingChange, a.onFatalError, navigate]);
}
