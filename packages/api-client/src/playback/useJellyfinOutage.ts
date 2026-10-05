import { useEffect, useMemo, useState } from "react";
import { getClockOffsetMs } from "../socket/clockSync";
import { getJellyfinHealth, onJellyfinHealth } from "../socket/jellyfinHealth";
import { outageView, type OutageView } from "./jellyfinOutage";

/**
 * La panne de Jellyfin vue par un lecteur (`jellyfinOutage.ts`) — suivie en
 * direct, et réévaluée d'elle-même aux bords (panne longue, fin de la reprise).
 * Hors panne, aucun minuteur ne tourne.
 */
export function useJellyfinOutage(): OutageView {
  const [health, setHealth] = useState(getJellyfinHealth);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => onJellyfinHealth((next) => {
    setHealth(next);
    setNow(Date.now());
  }), []);

  const view = useMemo(() => outageView(health, now, getClockOffsetMs(now)), [health, now]);

  useEffect(() => {
    if (view.nextChangeInMs === null) return;
    const timer = setTimeout(() => setNow(Date.now()), view.nextChangeInMs + 50);
    return () => clearTimeout(timer);
  }, [view.nextChangeInMs, view.phase]);

  return view;
}

/** Hors React (rappels d'hls.js, de mpv) : les détecteurs doivent-ils se taire ? */
export function playbackErrorsSuppressed(): boolean {
  const now = Date.now();
  return outageView(getJellyfinHealth(), now, getClockOffsetMs(now)).suppressErrors;
}
