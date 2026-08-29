import { useEffect, useState, type MutableRefObject } from "react";
import type { MpvState, PlayOptions } from "./useDesktopPlayer";
import { isSideCarIndex } from "./localPlaybackTrackSources";
import { traceCommand } from "./startupTrace";
import { wtLog } from "../watchTogether/wtLog";

interface UseMpvSourceOptions {
  state: MpvState;
  ready: boolean;
  fileLoaded: boolean;
  src: string;
  startPositionSeconds?: number;
  isDirectPlay: boolean;
  streamOffset: number;
  play: (options: PlayOptions) => Promise<void>;
  onStarted?: () => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  lastAbsolutePosRef: MutableRefObject<number>;
  effectiveMpvOffset: MutableRefObject<number>;
  offsetDetectedForSrc: MutableRefObject<string>;
  prevSrcRef: MutableRefObject<string>;
  hasStartedRef: MutableRefObject<boolean>;
  loadedExternalSubs: MutableRefObject<Map<number, number>>;
  audioTracks: { index: number }[];
  subtitleTracks: { index: number; external?: boolean }[];
  currentAudio: number;
  currentSubtitle: number | null;
  /** Fichier téléchargé, lu depuis le disque. */
  isLocalPlayback: boolean;
}

/**
 * `sid` à poser AVANT le `loadfile`, quand la track-list de mpv n'existe pas
 * encore. Rang parmi les sous-titres INTERNES au conteneur, +1 : mpv numérote
 * les siens par type à partir de 1, dans l'ordre du démuxeur, et Jellyfin lit
 * le même conteneur — en lecture directe le fichier est servi tel quel.
 *
 * Rend `0` (« no ») plutôt que `undefined` dans tous les cas non mappables :
 * `sid` PERSISTE d'un `loadfile` à l'autre, et ne rien poser laisserait soit
 * une valeur héritée, soit l'autosélection de mpv choisir une piste qu'on
 * remplacerait aussitôt — c'est ce remplacement, après l'ouverture, qui fait
 * jeter à mpv tout son cache (mpv#8422).
 *
 * Un sous-titre bitmap interne (PGS) est traité comme les autres : mpv le rend
 * nativement, c'est une piste du conteneur comme une autre.
 */
export function sidBeforeOpen(
  subtitleTracks: { index: number; external?: boolean }[],
  currentSubtitle: number | null,
  isDirectPlay: boolean,
): number {
  // Aucun sous-titre demandé.
  if (currentSubtitle == null) return 0;
  // Transcode : les renditions VTT du manifeste ne sont pas rendues par mpv et
  // le burn-in est déjà dans l'image. Poser `no` empêche une autosélection.
  if (!isDirectPlay) return 0;
  // Side-car local et externe serveur : absents du conteneur → `sub-add`.
  if (isSideCarIndex(currentSubtitle)) return 0;
  const internal = subtitleTracks.filter((t) => t.external !== true);
  const pos = internal.findIndex((t) => t.index === currentSubtitle);
  return pos < 0 ? 0 : pos + 1;
}

/**
 * Chargement de la source mpv + détection PTS + report de progression.
 * Retourne `sourceChanging` (overlay de chargement pendant un rebuild).
 */
export function useMpvSource({
  state, ready, fileLoaded, src, startPositionSeconds, isDirectPlay, streamOffset,
  play, onStarted, onProgress, onSeekComplete,
  lastAbsolutePosRef, effectiveMpvOffset, offsetDetectedForSrc, prevSrcRef,
  hasStartedRef, loadedExternalSubs,
  audioTracks, subtitleTracks, currentAudio, currentSubtitle, isLocalPlayback,
}: UseMpvSourceOptions) {
  const [sourceChanging, setSourceChanging] = useState(false);
  // State (not ref!) — transitioning to true triggers preference effect re-runs
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load media when ready
  useEffect(() => {
    if (!ready || !src) return;
    const isSourceChange = initialLoaded && prevSrcRef.current !== src;
    prevSrcRef.current = src;

    // Show loading overlay during source changes (quality/audio switch)
    if (isSourceChange) {
      // Tracé : un rebuild d'URL juste après la première image se voit à
      // l'écran comme un second chargement, sans qu'aucune coupure de cache
      // n'ait eu lieu. Les deux sont indiscernables à l'œil.
      traceCommand("rebuild de source", src.substring(0, 60));
      setSourceChanging(true);
    }

    // mpv must seek to the correct position for both direct play and transcode.
    // StartTimeTicks is stripped from HLS URLs (Jellyfin 10.10+ rejects it on segments),
    // so mpv always handles seeking client-side.
    const startPos = isSourceChange
      ? lastAbsolutePosRef.current
      : startPositionSeconds;

    wtLog("mpv-src", isSourceChange ? "REBUILD de source (qualité/audio/burn-in)" : "chargement initial", {
      src: src.substring(0, 110), startPosS: startPos?.toFixed(1) ?? "none",
      lastAbsolutePosS: lastAbsolutePosRef.current.toFixed(1), isDirectPlay,
    });
    // ⚠️ Les pistes partent AVANT l'ouverture, avec `start` et `pause` — pas
    // après. `aid`/`sid` persistent d'un loadfile à l'autre : posées ici, mpv
    // ouvre le fichier déjà sur la bonne, et n'a plus rien à reprendre ensuite.
    //
    // Les poser après la première image — ce que faisaient seuls les effets de
    // préférence, déclenchés par fileLoaded, donc sur playback-restart —
    // réinitialise la chaîne audio et resynchronise par un seek interne. mpv
    // JETTE alors son cache : la barre de chargement, qui venait de monter,
    // retombe d'un coup à zéro et un micro-chargement s'affiche, une seconde
    // après le démarrage. C'est un flush, pas une famine — d'où l'inutilité
    // d'agrandir quoi que ce soit pour le corriger.
    //
    // Mapping POSITIONNEL : la track-list de mpv n'existe pas encore à cet
    // instant. C'est le repli qu'utilise déjà useMpvTrackSync quand elle
    // manque ; si l'ordre ne coïncide pas, l'effet de préférence corrige au
    // retour de la liste — un reset au lieu de zéro, jamais plus qu'avant.
    // ⚠️ RIEN AVANT L'OUVERTURE EN LECTURE LOCALE, et c'est délibéré.
    //
    // Le mapping y est structurellement peu fiable : les pistes affichées
    // valent le DTO Jellyfin dès qu'il existe (useLocalPlaybackTracks), or le
    // fichier téléchargé peut être une variante allégée qui n'a pas les mêmes
    // pistes — et hors ligne il n'y a pas de DTO du tout. On posait donc une
    // sélection calculée sur la mauvaise liste, que la préférence locale ne
    // pouvait plus corriger derrière : `mpvTrackIntent` la prenait pour une
    // intention déjà satisfaite.
    //
    // Et il n'y a rien à y gagner : ce qu'on évite ici, c'est le vidage du
    // cache de mpv au changement de piste (mpv#8422). Sur un fichier posé sur
    // le disque, ce cache se reconstitue instantanément — le flush est gratuit.
    // Les préférences s'appliquent donc après l'ouverture, comme avant, quand
    // les pistes RÉELLES du fichier sont connues.
    const aPos = isLocalPlayback ? -1 : audioTracks.findIndex((t) => t.index === currentAudio);
    play({
      url: src,
      startPosition: startPos,
      // Transcode : Jellyfin ne sort que la piste demandée, toujours aid=1. À
      // poser explicitement, un aid=3 hérité d'un direct play laissant le flux
      // HLS sans audio.
      audioTrack: isDirectPlay ? (aPos >= 0 ? aPos + 1 : undefined) : 1,
      subtitleTrack: isLocalPlayback
        ? undefined
        : sidBeforeOpen(subtitleTracks, currentSubtitle, isDirectPlay),
    });
    loadedExternalSubs.current.clear();
    // State transition triggers preference effects in the NEXT render
    if (!initialLoaded) setInitialLoaded(true);
  }, [ready, src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect whether mpv reports absolute PTS (offset baked into HLS manifest) or
  // relative PTS (starting from 0).  Jellyfin HLS typically uses absolute PTS,
  // matching the web player behaviour (VideoPlayer.tsx effectiveOffset = 0).
  useEffect(() => {
    if (src === offsetDetectedForSrc.current) return;
    if (isDirectPlay || streamOffset === 0) {
      effectiveMpvOffset.current = 0;
      offsetDetectedForSrc.current = src;
      return;
    }
    // In transcode mode with streamOffset: wait for a meaningful position (> 5 s)
    if (state.position > 5) {
      offsetDetectedForSrc.current = src;
      if (state.position > streamOffset * 0.5) {
        // mpv reports absolute PTS — no additional offset needed
        effectiveMpvOffset.current = 0;
        wtLog("mpv-src", "détection PTS : absolus (offset 0)", { pos: state.position.toFixed(1), streamOffset });
      } else {
        // mpv reports relative PTS — must add offset
        effectiveMpvOffset.current = streamOffset;
        wtLog("mpv-src", "détection PTS : relatifs (offset appliqué)", { pos: state.position.toFixed(1), streamOffset });
      }
    }
  }, [state.position, src, isDirectPlay, streamOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report progress + track absolute position
  useEffect(() => {
    // Ignorer les événements du fichier PRÉCÉDENT : après un remount (changement
    // d'épisode), mpv rapporte encore position/paused de l'ancien média jusqu'au
    // chargement du nouveau — sans cette garde, la position de fin de l'ancien
    // épisode déclenche l'écran « épisode suivant » au début du nouveau.
    if (!fileLoaded) return;
    if (!state.playing && !hasStartedRef.current) return;
    if (state.playing && !hasStartedRef.current) { hasStartedRef.current = true; onStarted?.(); }
    const absolutePos = state.position + effectiveMpvOffset.current;
    const prevPos = lastAbsolutePosRef.current;
    lastAbsolutePosRef.current = absolutePos;
    onProgress?.(absolutePos, state.paused);
    // Watch Together : mpv n'a pas de callback central de seek — un saut de
    // position discontinu (hors changement de source) est un seek local.
    if (prevPos > 0 && !sourceChanging && Math.abs(absolutePos - prevPos) > 3) {
      wtLog("mpv-src", "saut de position détecté (seek local)", {
        fromS: prevPos.toFixed(1), toS: absolutePos.toFixed(1), paused: state.paused,
      });
      onSeekComplete?.(absolutePos, state.paused);
    }
  }, [state.position, state.paused, state.playing, fileLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear sourceChanging when playback resumes after a source change
  useEffect(() => {
    if (state.playing && sourceChanging) {
      wtLog("mpv-src", "rebuild terminé — lecture effective");
      setSourceChanging(false);
    }
  }, [state.playing, sourceChanging]);

  return { sourceChanging };
}
