import { useCallback, useEffect, useRef } from "react";
import { useJellyfinClient } from "./useJellyfinClient";

const TICKS_PER_SEC = 10_000_000;
const REPORT_INTERVAL_MS = 10_000;
const DBG = "[Tentacle:Playback]";

/**
 * Fire-and-forget POST to Jellyfin session endpoint.
 * Logs errors instead of silently swallowing them.
 * Uses raw fetch as fallback if client.fetch fails (to rule out client issues).
 */
async function sessionPost(
  client: { fetch: <T>(path: string, init?: RequestInit) => Promise<T>; getBaseUrl: () => string; getToken: () => string | null },
  path: string,
  body: Record<string, unknown>,
  label: string
): Promise<void> {
  const bodyStr = JSON.stringify(body);
  try {
    await client.fetch(path, { method: "POST", body: bodyStr });
    console.debug(DBG, `${label} OK`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(DBG, `${label} FAILED via client.fetch:`, msg);
    // Fallback: try raw fetch (bypasses JellyfinClient wrapper to rule out client-side issues)
    try {
      const baseUrl = client.getBaseUrl();
      const token = client.getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["X-Emby-Token"] = token;
        headers["X-Emby-Authorization"] = `MediaBrowser Token="${token}"`;
      }
      console.debug(DBG, `${label} retrying with raw fetch →`, `${baseUrl}${path}`);
      const res = await fetch(`${baseUrl}${path}`, { method: "POST", body: bodyStr, headers });
      console.debug(DBG, `${label} raw fetch result:`, res.status, res.statusText);
    } catch (err2: unknown) {
      console.error(DBG, `${label} raw fetch also FAILED:`, err2 instanceof Error ? err2.message : String(err2));
    }
  }
}

export function usePlaybackReporting(
  itemId: string | undefined,
  mediaSourceId: string | undefined,
  isDirectPlay = true
) {
  const client = useJellyfinClient();
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const startedRef = useRef(false);
  const playMethod = isDirectPlay ? "DirectPlay" : "Transcode";

  // Keep refs for unmount cleanup (avoids premature Stop events on dep changes)
  const clientRef = useRef(client);
  const itemIdRef = useRef(itemId);
  const msIdRef = useRef(mediaSourceId);
  const prevItemIdRef = useRef(itemId);
  clientRef.current = client;
  itemIdRef.current = itemId;
  msIdRef.current = mediaSourceId;

  // When itemId changes (episode switch), stop the old session and reset state
  useEffect(() => {
    const prevId = prevItemIdRef.current;
    prevItemIdRef.current = itemId;
    if (prevId && prevId !== itemId && startedRef.current) {
      console.debug(DBG, "episode switch — stopping old session", { prevId, newId: itemId, position: positionRef.current });
      sessionPost(clientRef.current, "/Sessions/Playing/Stopped", {
        ItemId: prevId,
        MediaSourceId: prevId,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
      }, "stopOldEpisode");
      startedRef.current = false;
      positionRef.current = 0;
    }
  }, [itemId]);

  const reportStart = useCallback(() => {
    if (!itemId || startedRef.current) return;
    console.debug(DBG, "reportStart", { itemId, mediaSourceId, playMethod, hasToken: !!client.getToken() });
    startedRef.current = true;
    sessionPost(client, "/Sessions/Playing", {
      ItemId: itemId,
      MediaSourceId: mediaSourceId ?? itemId,
      CanSeek: true,
      PlayMethod: playMethod,
    }, "reportStart");
  }, [client, itemId, mediaSourceId, playMethod]);

  const reportProgress = useCallback(() => {
    if (!itemId || !startedRef.current) return;
    const pos = positionRef.current;
    const paused = pausedRef.current;
    console.debug(DBG, "progress", { itemId: itemId.substring(0, 8), position: Math.floor(pos), paused });
    client.fetch("/Sessions/Playing/Progress", {
      method: "POST",
      body: JSON.stringify({
        ItemId: itemId,
        MediaSourceId: mediaSourceId ?? itemId,
        PositionTicks: Math.floor(pos * TICKS_PER_SEC),
        IsPaused: paused,
        PlayMethod: playMethod,
      }),
    }).catch((err: unknown) => {
      console.error(DBG, "progress FAILED:", err instanceof Error ? err.message : String(err));
    });
  }, [client, itemId, mediaSourceId, playMethod]);

  const updatePosition = useCallback((seconds: number, isPaused: boolean) => {
    positionRef.current = seconds;
    pausedRef.current = isPaused;
  }, []);

  // Periodic progress reporting
  useEffect(() => {
    if (!itemId) return;
    const interval = setInterval(reportProgress, REPORT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [itemId, reportProgress]);

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
      PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
    }, "reportStop");
  }, []);

  return { reportStart, reportStop, updatePosition };
}
