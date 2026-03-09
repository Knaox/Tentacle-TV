import { useCallback, useEffect, useRef } from "react";
import { useJellyfinClient } from "./useJellyfinClient";

const TICKS_PER_SEC = 10_000_000;
const REPORT_INTERVAL_MS = 10_000;
const DBG = "[Playback]";

/** Convert seconds to Jellyfin ticks, guarding against NaN/Infinity. */
function safePositionTicks(seconds: number): number {
  const ticks = Math.floor(seconds * TICKS_PER_SEC);
  return Number.isFinite(ticks) && ticks >= 0 ? ticks : 0;
}

type JfClient = {
  fetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  getBaseUrl: () => string;
  getToken: () => string | null;
  getDeviceId: () => string;
  getAuthHeader: () => string;
  useCredentials: boolean;
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
        headers["X-Emby-Authorization"] = client.getAuthHeader();
      }
      const res = await fetch(`${baseUrl}${path}`, { method: "POST", body: bodyStr, headers });
      if (!res.ok) console.error(`[Playback] ${label} fallback fetch:`, res.status);
    } catch (err2: unknown) {
      console.error(DBG, `${label} raw fetch also FAILED:`, err2 instanceof Error ? err2.message : String(err2));
    }
  }
}

/** Build a sendBeacon-compatible URL.
 *  When using httpOnly cookies (web), no api_key needed — cookie is sent automatically.
 *  Mobile/desktop still need api_key in the URL (sendBeacon can't set headers). */
function beaconUrl(client: JfClient, path: string): string {
  const base = client.getBaseUrl();
  if (client.useCredentials) return `${base}${path}`;
  const token = client.getToken();
  return token ? `${base}${path}?api_key=${encodeURIComponent(token)}` : `${base}${path}`;
}

/**
 * Fire-and-forget DELETE to kill an active Jellyfin transcode (ffmpeg process).
 * Uses api_key query param since headers can't be set in keepalive/beacon contexts.
 */
function killActiveEncoding(client: JfClient, playSessionId: string | undefined, keepalive = false): Promise<void> {
  if (!playSessionId) return Promise.resolve();
  const deviceId = client.getDeviceId();
  const base = client.getBaseUrl();
  const token = client.getToken();
  const url = `${base}/Videos/ActiveEncodings?deviceId=${encodeURIComponent(deviceId)}&playSessionId=${encodeURIComponent(playSessionId)}`;
  // Include auth header so the request works through the proxy.
  // Also keep api_key query param as fallback for sendBeacon contexts.
  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Emby-Token"] = token;
    headers["X-Emby-Authorization"] = client.getAuthHeader();
  }
  return fetch(url, { method: "DELETE", headers, keepalive }).then(() => {}).catch(() => {});
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

  // Promise from the last stop call — lets callers (Watch.tsx) chain cache
  // invalidation after Jellyfin has processed the final position.
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
    if (startedRef.current && !bgModeRef.current) {
      intervalRef.current = setInterval(reportProgress, REPORT_INTERVAL_MS);
    }
  }, [reportProgress, clearProgressInterval]);

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
    reportProgress();   // send immediately with new position
    resetInterval();    // restart 10s timer from now
  }, [reportProgress, resetInterval]);

  // --- beforeunload + visibilitychange (background tab resilience) ---
  // Chrome throttles/freezes setInterval in background tabs after ~5 min.
  // When the tab goes hidden, switch to sendBeacon-based periodic reporting
  // (fire-and-forget, survives throttling). Restore normal fetch interval
  // when the tab returns to foreground.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;

    const buildProgressBody = () => JSON.stringify({
      ItemId: itemIdRef.current,
      MediaSourceId: msIdRef.current ?? itemIdRef.current,
      PlaySessionId: playSessionIdRef.current ?? undefined,
      PositionTicks: safePositionTicks(positionRef.current),
      IsPaused: pausedRef.current,
      CanSeek: true,
      PlayMethod: playMethodRef.current,
      AudioStreamIndex: audioIdxRef.current,
      SubtitleStreamIndex: subIdxRef.current ?? -1,
    });

    const sendProgressBeacon = () => {
      if (!itemIdRef.current || !startedRef.current) return;
      const url = beaconUrl(clientRef.current, "/Sessions/Playing/Progress");
      const blob = new Blob([buildProgressBody()], { type: "application/json" });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, blob);
      }
    };

    const startBgBeaconInterval = () => {
      if (bgIntervalRef.current) clearInterval(bgIntervalRef.current);
      bgIntervalRef.current = setInterval(sendProgressBeacon, REPORT_INTERVAL_MS);
    };

    const onBeforeUnload = () => {
      if (!itemIdRef.current || !startedRef.current) return;
      clearProgressInterval();
      startedRef.current = false;
      killActiveEncoding(clientRef.current, playSessionIdRef.current, true);
      const url = beaconUrl(clientRef.current, "/Sessions/Playing/Stopped");
      const blob = new Blob([JSON.stringify({
        ItemId: itemIdRef.current,
        MediaSourceId: msIdRef.current ?? itemIdRef.current,
        PlaySessionId: playSessionIdRef.current ?? undefined,
        PositionTicks: safePositionTicks(positionRef.current),
      })], { type: "application/json" });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, blob);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!itemIdRef.current || !startedRef.current) return;
        // Tab → background: kill the fetch-based interval (will be throttled/frozen)
        // and switch to beacon-based reporting.
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        bgModeRef.current = true;
        sendProgressBeacon();
        startBgBeaconInterval();
      } else {
        // Tab → foreground: restore normal fetch-based reporting.
        // clearProgressInterval handles both intervals + resets bgModeRef.
        clearProgressInterval();
        if (itemIdRef.current && startedRef.current) {
          sendProgressBeacon(); // immediate catch-up report
        }
        resetIntervalRef.current();
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
  // triggering cleanup on every dependency change.
  // Saves the Promise so Watch.tsx can chain cache invalidation after it.
  useEffect(() => {
    return () => {
      clearProgressInterval();
      const id = itemIdRef.current;
      if (!id || !startedRef.current) return;
      startedRef.current = false;
      killActiveEncoding(clientRef.current, playSessionIdRef.current);
      lastStopPromiseRef.current = sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
        ItemId: id,
        MediaSourceId: msIdRef.current ?? id,
        PlaySessionId: playSessionIdRef.current ?? undefined,
        PositionTicks: safePositionTicks(positionRef.current),
      }, "stopOnUnmount");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit stop for platforms that call it manually (TV, mobile).
  // Returns a Promise so callers can wait for Jellyfin to acknowledge
  // the final position before invalidating caches.
  const reportStop = useCallback((): Promise<void> => {
    clearProgressInterval();
    const id = itemIdRef.current;
    if (!id || !startedRef.current) return Promise.resolve();
    startedRef.current = false;
    killActiveEncoding(clientRef.current, playSessionIdRef.current);
    return sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
      ItemId: id,
      MediaSourceId: msIdRef.current ?? id,
      PlaySessionId: playSessionIdRef.current ?? undefined,
      PositionTicks: safePositionTicks(positionRef.current),
    }, "reportStop");
  }, []);

  /** Kill the active transcode — exposed for seek in transcoded mode. */
  const killTranscode = useCallback((sessionId?: string): Promise<void> => {
    return killActiveEncoding(clientRef.current, sessionId ?? playSessionIdRef.current);
  }, []);

  return { reportStart, reportStop, updatePosition, reportSeek, killTranscode, lastStopPromiseRef };
}
