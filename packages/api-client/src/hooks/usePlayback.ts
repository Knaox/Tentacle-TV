import { useCallback, useEffect, useRef } from "react";
import { useJellyfinClient } from "./useJellyfinClient";

const TICKS_PER_SEC = 10_000_000;
const REPORT_INTERVAL_MS = 10_000;

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
      clientRef.current.fetch("/Sessions/Playing/Stopped", {
        method: "POST",
        body: JSON.stringify({
          ItemId: prevId,
          MediaSourceId: prevId,
          PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
        }),
      }).catch(() => {});
      startedRef.current = false;
      positionRef.current = 0;
    }
  }, [itemId]);

  const reportStart = useCallback(() => {
    if (!itemId || startedRef.current) return;
    startedRef.current = true;
    client.fetch("/Sessions/Playing", {
      method: "POST",
      body: JSON.stringify({
        ItemId: itemId,
        MediaSourceId: mediaSourceId ?? itemId,
        CanSeek: true,
        PlayMethod: playMethod,
      }),
    }).catch(() => {});
  }, [client, itemId, mediaSourceId, playMethod]);

  const reportProgress = useCallback(() => {
    if (!itemId || !startedRef.current) return;
    client.fetch("/Sessions/Playing/Progress", {
      method: "POST",
      body: JSON.stringify({
        ItemId: itemId,
        MediaSourceId: mediaSourceId ?? itemId,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
        IsPaused: pausedRef.current,
        PlayMethod: playMethod,
      }),
    }).catch(() => {});
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
      clientRef.current.fetch("/Sessions/Playing/Stopped", {
        method: "POST",
        body: JSON.stringify({
          ItemId: id,
          MediaSourceId: msIdRef.current ?? id,
          PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
        }),
      }).catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit stop for platforms that call it manually (TV, mobile)
  const reportStop = useCallback(() => {
    const id = itemIdRef.current;
    if (!id || !startedRef.current) return;
    startedRef.current = false;
    clientRef.current.fetch("/Sessions/Playing/Stopped", {
      method: "POST",
      body: JSON.stringify({
        ItemId: id,
        MediaSourceId: msIdRef.current ?? id,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
      }),
    }).catch(() => {});
  }, []);

  return { reportStart, reportStop, updatePosition };
}
