import { useCallback, useEffect, useRef } from "react";
import { useJellyfinClient } from "./useJellyfinClient";

const TICKS_PER_SEC = 10_000_000;
const REPORT_INTERVAL_MS = 10_000;

export function usePlaybackReporting(
  itemId: string | undefined,
  mediaSourceId: string | undefined
) {
  const client = useJellyfinClient();
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const startedRef = useRef(false);

  const reportStart = useCallback(() => {
    if (!itemId || startedRef.current) return;
    startedRef.current = true;
    client.fetch("/Sessions/Playing", {
      method: "POST",
      body: JSON.stringify({
        ItemId: itemId,
        MediaSourceId: mediaSourceId ?? itemId,
        CanSeek: true,
        PlayMethod: "DirectPlay",
      }),
    }).catch(() => {});
  }, [client, itemId, mediaSourceId]);

  const reportProgress = useCallback(() => {
    if (!itemId) return;
    client.fetch("/Sessions/Playing/Progress", {
      method: "POST",
      body: JSON.stringify({
        ItemId: itemId,
        MediaSourceId: mediaSourceId ?? itemId,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
        IsPaused: pausedRef.current,
        PlayMethod: "DirectPlay",
      }),
    }).catch(() => {});
  }, [client, itemId, mediaSourceId]);

  const reportStop = useCallback(() => {
    if (!itemId || !startedRef.current) return;
    startedRef.current = false;
    client.fetch("/Sessions/Playing/Stopped", {
      method: "POST",
      body: JSON.stringify({
        ItemId: itemId,
        MediaSourceId: mediaSourceId ?? itemId,
        PositionTicks: Math.floor(positionRef.current * TICKS_PER_SEC),
      }),
    }).catch(() => {});
  }, [client, itemId, mediaSourceId]);

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

  // Report stop on unmount
  useEffect(() => {
    return () => { reportStop(); };
  }, [reportStop]);

  return { reportStart, reportStop, updatePosition };
}
