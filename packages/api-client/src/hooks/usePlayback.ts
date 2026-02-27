import { useCallback, useEffect, useRef } from "react";
import { useJellyfinClient } from "./useJellyfinClient";

const TICKS_PER_SEC = 10_000_000;
const REPORT_INTERVAL_MS = 10_000;
const DBG = "[Playback]";

type JfClient = {
  fetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  getBaseUrl: () => string;
  getToken: () => string | null;
};

/**
 * Fire-and-forget POST to Jellyfin session endpoint.
 * Logs errors instead of silently swallowing them.
 * Uses raw fetch as fallback if client.fetch fails (to rule out client issues).
 */
async function sessionPost(
  client: JfClient,
  path: string,
  body: Record<string, unknown>,
  label: string,
): Promise<void> {
  const bodyStr = JSON.stringify(body);
  try {
    await client.fetch(path, { method: "POST", body: bodyStr });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(DBG, `${label} FAILED via client.fetch:`, msg);
    try {
      const baseUrl = client.getBaseUrl();
      const token = client.getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["X-Emby-Token"] = token;
        headers["X-Emby-Authorization"] = `MediaBrowser Token="${token}"`;
      }
      const res = await fetch(`${baseUrl}${path}`, { method: "POST", body: bodyStr, headers });
      if (!res.ok) console.error(`[Playback] ${label} fallback fetch:`, res.status);
    } catch (err2: unknown) {
      console.error(DBG, `${label} raw fetch also FAILED:`, err2 instanceof Error ? err2.message : String(err2));
    }
  }
}

/** Build a sendBeacon-compatible URL with api_key auth (sendBeacon can't set headers). */
function beaconUrl(client: JfClient, path: string): string {
  const base = client.getBaseUrl();
  const token = client.getToken();
  return token ? `${base}${path}?api_key=${encodeURIComponent(token)}` : `${base}${path}`;
}

export interface PlaybackReportingOptions {
  itemId: string | undefined;
  mediaSourceId: string | undefined;
  isDirectPlay: boolean;
  /** Remux mode: video copied, only audio transcoded */
  isDirectStream?: boolean;
  playSessionId: string | undefined;
  audioStreamIndex: number;
  subtitleStreamIndex: number | null;
}

export function usePlaybackReporting({
  itemId, mediaSourceId, isDirectPlay, isDirectStream,
  playSessionId, audioStreamIndex, subtitleStreamIndex,
}: PlaybackReportingOptions) {
  const client = useJellyfinClient();
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const startedRef = useRef(false);
  const playMethod = isDirectPlay ? "DirectPlay" : isDirectStream ? "DirectStream" : "Transcode";

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

  // When itemId changes (episode switch), stop the old session and reset state
  useEffect(() => {
    const prevId = prevItemIdRef.current;
    prevItemIdRef.current = itemId;
    if (prevId && prevId !== itemId && startedRef.current) {
      sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
        ItemId: prevId,
        MediaSourceId: prevId,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
        PlaySessionId: playSessionIdRef.current ?? undefined,
      }, "stopOldEpisode");
      startedRef.current = false;
      positionRef.current = 0;
    }
  }, [itemId]);

  const reportStart = useCallback(() => {
    if (!itemId) return;
    startedRef.current = true;
    sessionPost(client, "/Sessions/Playing", {
      ItemId: itemId,
      MediaSourceId: mediaSourceId ?? itemId,
      PlaySessionId: playSessionId ?? undefined,
      CanSeek: true,
      PlayMethod: playMethod,
      AudioStreamIndex: audioStreamIndex,
      SubtitleStreamIndex: subtitleStreamIndex ?? -1,
      PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
      IsPaused: false,
    }, "reportStart");
  }, [client, itemId, mediaSourceId, playMethod, playSessionId, audioStreamIndex, subtitleStreamIndex]);

  const reportProgress = useCallback(() => {
    if (!itemId || !startedRef.current) return;
    const pos = positionRef.current;
    const paused = pausedRef.current;
    sessionPost(client, "/Sessions/Playing/Progress", {
      ItemId: itemId,
      MediaSourceId: mediaSourceId ?? itemId,
      PlaySessionId: playSessionId ?? undefined,
      PositionTicks: Math.floor(pos * TICKS_PER_SEC),
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

  // --- Interval management ---
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(reportProgress, REPORT_INTERVAL_MS);
  }, [reportProgress]);

  // Periodic progress reporting
  useEffect(() => {
    if (!itemId) return;
    resetInterval();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [itemId, resetInterval]);

  // --- Immediate report after seek (Bug #1 fix) ---
  const reportSeek = useCallback((seconds: number, isPaused: boolean) => {
    positionRef.current = seconds;
    pausedRef.current = isPaused;
    reportProgress();   // send immediately with new position
    resetInterval();    // restart 10s timer from now
  }, [reportProgress, resetInterval]);

  // --- beforeunload + visibilitychange (Bug #2 fix) ---
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;

    const buildBody = () => JSON.stringify({
      ItemId: itemIdRef.current,
      MediaSourceId: msIdRef.current ?? itemIdRef.current,
      PlaySessionId: playSessionIdRef.current ?? undefined,
      PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
    });

    const onBeforeUnload = () => {
      if (!itemIdRef.current || !startedRef.current) return;
      startedRef.current = false;
      const url = beaconUrl(clientRef.current, "/Sessions/Playing/Stopped");
      const blob = new Blob([buildBody()], { type: "application/json" });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, blob);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (!itemIdRef.current || !startedRef.current) return;
      const url = beaconUrl(clientRef.current, "/Sessions/Playing/Progress");
      const body = JSON.stringify({
        ItemId: itemIdRef.current,
        MediaSourceId: msIdRef.current ?? itemIdRef.current,
        PlaySessionId: playSessionIdRef.current ?? undefined,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
        IsPaused: pausedRef.current,
        CanSeek: true,
        PlayMethod: playMethodRef.current,
        AudioStreamIndex: audioIdxRef.current,
        SubtitleStreamIndex: subIdxRef.current ?? -1,
      });
      const blob = new Blob([body], { type: "application/json" });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, blob);
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Report stop on unmount only — refs ensure we use latest values without
  // triggering cleanup on every dependency change
  useEffect(() => {
    return () => {
      const id = itemIdRef.current;
      if (!id || !startedRef.current) return;
      startedRef.current = false;
      sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
        ItemId: id,
        MediaSourceId: msIdRef.current ?? id,
        PlaySessionId: playSessionIdRef.current ?? undefined,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
      }, "stopOnUnmount");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit stop for platforms that call it manually (TV, mobile)
  const reportStop = useCallback(() => {
    const id = itemIdRef.current;
    if (!id || !startedRef.current) return;
    startedRef.current = false;
    sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
      ItemId: id,
      MediaSourceId: msIdRef.current ?? id,
      PlaySessionId: playSessionIdRef.current ?? undefined,
      PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
    }, "reportStop");
  }, []);

  return { reportStart, reportStop, updatePosition, reportSeek };
}
