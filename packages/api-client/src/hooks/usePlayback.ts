import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useJellyfinClient } from "./useJellyfinClient";
import { killActiveEncoding, safePositionTicks, sessionPost } from "./playbackTransport";
import { usePlaybackBeacons } from "./usePlaybackBeacons";
import { isDataSaverActive, localReportMode, subscribeDataSaver } from "../net/dataSaver";
import { channelStart, clearActivePlayback, setActivePlayback } from "../socket/sessionChannel";
import { applyPosition, channelEdge, reportStopped, stateFromRefs, type PlaybackStateRefs } from "./playbackChannelReport";

const REPORT_INTERVAL_MS = 10_000;

export interface PlaybackReportingOptions {
  itemId: string | undefined;
  mediaSourceId: string | undefined;
  isDirectPlay: boolean;
  /** Remux mode: video copied, only audio transcoded */
  isDirectStream?: boolean;
  playSessionId: string | undefined;
  audioStreamIndex: number;
  subtitleStreamIndex: number | null;
  /** Lecture d'un fichier LOCAL (desktop) : autorise le reporting « bords »
   *  en mode économie. En streaming le heartbeat maintient aussi le
   *  transcodage vivant côté Jellyfin — on n'y touche jamais. */
  localPlayback?: boolean;
}

/**
 * Ce qu'un lecteur attend de son rapporteur — le serveur (`usePlaybackReporting`)
 * comme le fichier local (progression en SQLite, un seul envoi à la sortie).
 */
export interface PlaybackReporter {
  reportStart: (initialPositionSeconds?: number) => void;
  updatePosition: (seconds: number, isPaused: boolean) => void;
  reportSeek: (seconds: number, isPaused: boolean) => void;
  reportStop: () => Promise<void>;
  /** Promesse du DERNIER arrêt réellement posté ; le rangement de sortie s'y enchaîne. */
  lastStopPromiseRef: { current: Promise<void> };
}

export function usePlaybackReporting({
  itemId, mediaSourceId, isDirectPlay, isDirectStream,
  playSessionId, audioStreamIndex, subtitleStreamIndex, localPlayback,
}: PlaybackReportingOptions) {
  const client = useJellyfinClient();

  // Souscription au mode économie : c'est elle qui redéclenche le rendu quand
  // il bascule en cours de lecture. La décision reste dans le socle.
  useSyncExternalStore(subscribeDataSaver, isDataSaverActive, isDataSaverActive);
  /**
   * Reporting « bords » : `/Sessions/Playing` au début, `/Sessions/Playing/Stopped`
   * à la fin, RIEN entre les deux — ni interval fetch, ni interval beacon.
   * 720 requêtes → 2 sur un film de 2 h.
   *
   * Rien n'est perdu pour autant : la position continue d'être écrite en SQLite
   * toutes les 10 s par `useLocalPlaybackReporting` (0 octet réseau) et rejoint
   * la file de resynchronisation, drainée au lancement suivant — c'est le filet
   * anti-crash. Les beacons ponctuels (passage en arrière-plan, fermeture de
   * fenêtre) sont eux CONSERVÉS : un message, pas un battement.
   */
  const edgesOnly = !!localPlayback && localReportMode() === "edges";
  const edgesOnlyRef = useRef(edgesOnly);
  edgesOnlyRef.current = edgesOnly;
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const startedRef = useRef(false);
  const playMethod = isDirectPlay ? "DirectPlay" : isDirectStream ? "DirectStream" : "Transcode";

  // Promesse du DERNIER `/Sessions/Playing/Stopped` réellement posté — par le
  // cleanup de démontage (web, bureau) comme par `reportStop()` explicite
  // (mobile, téléviseur). Les appelants y enchaînent leur rangement de sortie,
  // une fois que Jellyfin a écrit la position finale et `Played`.
  const lastStopPromiseRef = useRef<Promise<void>>(Promise.resolve());

  // Refs for unmount cleanup (avoids premature Stop events on dep changes)
  const clientRef = useRef(client);
  const itemIdRef = useRef(itemId);
  const msIdRef = useRef(mediaSourceId);
  const playSessionIdRef = useRef(playSessionId);
  const audioIdxRef = useRef(audioStreamIndex);
  const subIdxRef = useRef(subtitleStreamIndex);
  const prevItemIdRef = useRef(itemId);
  const playMethodRef = useRef(playMethod);

  clientRef.current = client;
  itemIdRef.current = itemId;
  msIdRef.current = mediaSourceId;
  playSessionIdRef.current = playSessionId;
  audioIdxRef.current = audioStreamIndex;
  subIdxRef.current = subtitleStreamIndex;
  playMethodRef.current = playMethod;

  // Vue « état de lecture » des refs pour le canal de session : quand le backend
  // porte la télémétrie, un report est un message sur le socket (voir `playbackChannelReport`).
  const stateRefsRef = useRef<PlaybackStateRefs | null>(null);
  stateRefsRef.current ??= {
    itemId: itemIdRef, mediaSourceId: msIdRef, playSessionId: playSessionIdRef, playMethod: playMethodRef,
    audioStreamIndex: audioIdxRef, subtitleStreamIndex: subIdxRef, position: positionRef, paused: pausedRef,
  };
  const stateRefs = stateRefsRef.current;
  /** Relu par le canal à chaque (ré)ouverture en pleine lecture. */
  const activeProviderRef = useRef(() => (startedRef.current ? stateFromRefs(stateRefs) : null));
  const lastUpdateAtRef = useRef(0); // dernier `updatePosition` : c'est de là qu'on lit un saut

  // --- Interval management (declared early — used by all stop paths) ---
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Background beacon interval (sendBeacon-based, for when tab is hidden). */
  const bgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** True when the tab is hidden — prevents fetch-based interval in background. */
  const bgModeRef = useRef(false);

  /** Kill all progress intervals (fetch-based AND background beacon).
   *  Called from every stop/cleanup path. */
  const clearProgressInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (bgIntervalRef.current) {
      clearInterval(bgIntervalRef.current);
      bgIntervalRef.current = null;
    }
    bgModeRef.current = false;
  }, []);

  // When itemId changes (episode switch), stop the old session and reset state
  useEffect(() => {
    const prevId = prevItemIdRef.current;
    prevItemIdRef.current = itemId;
    if (prevId && prevId !== itemId && startedRef.current) {
      clearProgressInterval();
      killActiveEncoding(clientRef.current, playSessionIdRef.current);
      const previous = stateFromRefs(stateRefs);
      if (previous) {
        void reportStopped(clientRef.current, { ...previous, itemId: prevId, mediaSourceId: prevId }, "stopOldEpisode");
      }
      clearActivePlayback(activeProviderRef.current);
      startedRef.current = false;
      positionRef.current = 0;
    }
  }, [itemId, clearProgressInterval, stateRefs]);

  const reportProgress = useCallback(() => {
    if (!itemId || !startedRef.current) return;
    // Par le canal, le battement tient la position du backend à jour — c'est
    // elle qui part si ce lecteur disparaît. Jellyfin n'en voit rien.
    if (channelEdge(stateRefs, "tick")) return;
    const pos = positionRef.current;
    const paused = pausedRef.current;
    sessionPost(client, "/Sessions/Playing/Progress", {
      ItemId: itemId,
      MediaSourceId: mediaSourceId ?? itemId,
      PlaySessionId: playSessionId ?? undefined,
      PositionTicks: safePositionTicks(pos),
      IsPaused: paused,
      CanSeek: true,
      PlayMethod: playMethod,
      AudioStreamIndex: audioStreamIndex,
      SubtitleStreamIndex: subtitleStreamIndex ?? -1,
    }, "progress");
  }, [client, itemId, mediaSourceId, playMethod, playSessionId, audioStreamIndex, subtitleStreamIndex, stateRefs]);

  const updatePosition = useCallback((seconds: number, isPaused: boolean) => {
    applyPosition(stateRefs, lastUpdateAtRef, startedRef.current, seconds, isPaused);
  }, [stateRefs]);

  const resetInterval = useCallback(() => {
    clearProgressInterval();
    if (startedRef.current && !bgModeRef.current && !edgesOnly) {
      intervalRef.current = setInterval(reportProgress, REPORT_INTERVAL_MS);
    }
  }, [reportProgress, clearProgressInterval, edgesOnly]);

  const reportStart = useCallback((initialPositionSeconds?: number) => {
    if (!itemId || startedRef.current) return;
    startedRef.current = true;
    if (initialPositionSeconds != null && initialPositionSeconds > 0) {
      positionRef.current = initialPositionSeconds;
    }
    lastUpdateAtRef.current = 0;
    setActivePlayback(activeProviderRef.current);
    const state = stateFromRefs(stateRefs);
    if (state && channelStart(state)) {
      resetInterval();
      return;
    }
    sessionPost(client, "/Sessions/Playing", {
      ItemId: itemId,
      MediaSourceId: mediaSourceId ?? itemId,
      PlaySessionId: playSessionId ?? undefined,
      CanSeek: true,
      PlayMethod: playMethod,
      AudioStreamIndex: audioStreamIndex,
      SubtitleStreamIndex: subtitleStreamIndex ?? -1,
      PositionTicks: safePositionTicks(positionRef.current),
      IsPaused: false,
    }, "reportStart");
    resetInterval();
  }, [client, itemId, mediaSourceId, playMethod, playSessionId, audioStreamIndex, subtitleStreamIndex, resetInterval, stateRefs]);

  // Par le canal, un changement de piste est un bord ; sans canal, le prochain
  // battement le porte (les refs sont déjà à jour).
  useEffect(() => {
    if (startedRef.current) channelEdge(stateRefs, "tracks");
  }, [audioStreamIndex, subtitleStreamIndex, stateRefs]);

  // Ref to latest resetInterval — used by visibilitychange handler ([] deps effect).
  const resetIntervalRef = useRef(resetInterval);
  resetIntervalRef.current = resetInterval;

  // Periodic progress reporting
  useEffect(() => {
    if (!itemId) return;
    resetInterval();
    return clearProgressInterval;
  }, [itemId, resetInterval, clearProgressInterval]);

  // --- Immediate report after seek (Bug #1 fix) ---
  const reportSeek = useCallback((seconds: number, isPaused: boolean) => {
    positionRef.current = seconds;
    pausedRef.current = isPaused;
    lastUpdateAtRef.current = Date.now();
    if (startedRef.current && channelEdge(stateRefs, "seek")) return;
    // Mode « bords » : un seek ne vaut pas un aller-retour réseau — la position
    // est de toute façon écrite en SQLite et envoyée à la fermeture.
    if (edgesOnlyRef.current) return;
    reportProgress();   // send immediately with new position
    resetInterval();    // restart 10s timer from now
  }, [reportProgress, resetInterval, stateRefs]);

  // Résilience arrière-plan / fermeture (beacons) — extrait dans son propre
  // fichier pour tenir la limite de 300 lignes.
  usePlaybackBeacons({
    reportIntervalMs: REPORT_INTERVAL_MS,
    clearProgressInterval,
    refs: {
      client: clientRef,
      itemId: itemIdRef,
      mediaSourceId: msIdRef,
      playSessionId: playSessionIdRef,
      audioStreamIndex: audioIdxRef,
      subtitleStreamIndex: subIdxRef,
      playMethod: playMethodRef,
      position: positionRef,
      paused: pausedRef,
      started: startedRef,
      interval: intervalRef,
      bgInterval: bgIntervalRef,
      bgMode: bgModeRef,
      edgesOnly: edgesOnlyRef,
      resetInterval: resetIntervalRef,
    },
  });

  // Report stop on unmount only — refs ensure we use latest values without
  // triggering cleanup on every dependency change.
  // Saves the Promise so Watch.tsx can chain cache invalidation after it.
  useEffect(() => {
    const provider = activeProviderRef.current;
    return () => {
      clearProgressInterval();
      // Le kill passe DEVANT le garde « la lecture a démarré » (cf. reportStop).
      killActiveEncoding(clientRef.current, playSessionIdRef.current);
      const state = stateFromRefs(stateRefs);
      clearActivePlayback(provider);
      if (!state || !startedRef.current) return;
      startedRef.current = false;
      lastStopPromiseRef.current = reportStopped(clientRef.current, state, "stopOnUnmount");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrêt explicite, pour les plateformes qui l'appellent elles-mêmes (mobile,
  // téléviseur). Rend la promesse du POST et la mémorise AUSSI dans
  // `lastStopPromiseRef` : une seule source de vérité du « dernier Stopped
  // réel », quel que soit le chemin qui l'a posté. Une lecture déjà arrêtée ne
  // touche pas au ref — il garde la promesse du vrai arrêt.
  const reportStop = useCallback((): Promise<void> => {
    clearProgressInterval();
    // Le transcodage est lancé par la REQUÊTE DE FLUX, pas par `reportStart` :
    // ffmpeg tourne déjà pendant que le lecteur charge. Tant que le kill était
    // derrière le garde ci-dessous, sortir avant la première image laissait un
    // encodage vivant et ses fichiers temporaires sur le serveur. Il passe donc
    // devant : sans `playSessionId`, killActiveEncoding ne fait rien de toute
    // façon. Le `/Sessions/Playing/Stopped`, lui, reste gardé — rapporter
    // l'arrêt d'une lecture jamais commencée serait faux.
    killActiveEncoding(clientRef.current, playSessionIdRef.current);
    const state = stateFromRefs(stateRefs);
    clearActivePlayback(activeProviderRef.current);
    if (!state || !startedRef.current) return Promise.resolve();
    startedRef.current = false;
    const stopped = reportStopped(clientRef.current, state, "reportStop");
    lastStopPromiseRef.current = stopped;
    return stopped;
  }, [stateRefs, clearProgressInterval]);

  /** Kill the active transcode — exposed for seek in transcoded mode. */
  const killTranscode = useCallback((sessionId?: string): Promise<void> => {
    return killActiveEncoding(clientRef.current, sessionId ?? playSessionIdRef.current);
  }, []);

  return { reportStart, reportStop, updatePosition, reportSeek, killTranscode, lastStopPromiseRef };
}
