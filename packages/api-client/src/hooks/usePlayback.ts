import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useJellyfinClient } from "./useJellyfinClient";
import { killActiveEncoding, safePositionTicks, sessionPost } from "./playbackTransport";
import { usePlaybackBeacons } from "./usePlaybackBeacons";
import { isDataSaverActive, localReportMode, subscribeDataSaver } from "../net/dataSaver";

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
      sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
        ItemId: prevId,
        MediaSourceId: prevId,
        PositionTicks: safePositionTicks(positionRef.current),
        PlaySessionId: playSessionIdRef.current ?? undefined,
      }, "stopOldEpisode");
      startedRef.current = false;
      positionRef.current = 0;
    }
  }, [itemId, clearProgressInterval]);

  const reportProgress = useCallback(() => {
    if (!itemId || !startedRef.current) return;
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
  }, [client, itemId, mediaSourceId, playMethod, playSessionId, audioStreamIndex, subtitleStreamIndex]);

  const updatePosition = useCallback((seconds: number, isPaused: boolean) => {
    positionRef.current = seconds;
    pausedRef.current = isPaused;
  }, []);

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
  }, [client, itemId, mediaSourceId, playMethod, playSessionId, audioStreamIndex, subtitleStreamIndex, resetInterval]);

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
    // Mode « bords » : un seek ne vaut pas un aller-retour réseau — la position
    // est de toute façon écrite en SQLite et envoyée à la fermeture.
    if (edgesOnlyRef.current) return;
    reportProgress();   // send immediately with new position
    resetInterval();    // restart 10s timer from now
  }, [reportProgress, resetInterval]);

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
    return () => {
      clearProgressInterval();
      // Le kill passe DEVANT le garde « la lecture a démarré » (cf. reportStop).
      killActiveEncoding(clientRef.current, playSessionIdRef.current);
      const id = itemIdRef.current;
      if (!id || !startedRef.current) return;
      startedRef.current = false;
      lastStopPromiseRef.current = sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
        ItemId: id,
        MediaSourceId: msIdRef.current ?? id,
        PlaySessionId: playSessionIdRef.current ?? undefined,
        PositionTicks: safePositionTicks(positionRef.current),
      }, "stopOnUnmount");
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
    const id = itemIdRef.current;
    if (!id || !startedRef.current) return Promise.resolve();
    startedRef.current = false;
    const stopped = sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
      ItemId: id,
      MediaSourceId: msIdRef.current ?? id,
      PlaySessionId: playSessionIdRef.current ?? undefined,
      PositionTicks: safePositionTicks(positionRef.current),
    }, "reportStop");
    lastStopPromiseRef.current = stopped;
    return stopped;
  }, []);

  /** Kill the active transcode — exposed for seek in transcoded mode. */
  const killTranscode = useCallback((sessionId?: string): Promise<void> => {
    return killActiveEncoding(clientRef.current, sessionId ?? playSessionIdRef.current);
  }, []);

  return { reportStart, reportStop, updatePosition, reportSeek, killTranscode, lastStopPromiseRef };
}
