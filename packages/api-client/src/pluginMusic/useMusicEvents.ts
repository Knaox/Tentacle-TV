import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { MUSIC_EVENT_TYPES, type MusicEvent } from "@tentacle-tv/shared/music";
import { acquireSocket, onSocketStatus, subscribeSocket, type SocketStatus } from "../socket/tentacleSocket";
import { musicPendingKey } from "./useMusicActions";

/**
 * Les événements `music:*` du canal des comptes (`/api/ws`), additifs : un
 * client qui ne les connaît pas les ignore. Ce crochet fait ce que TOUT client
 * doit faire — relire la liste d'attente (`music:pending`, `music:resolved`) et
 * les extensions actives (`music:provider`) — et passe chaque événement à
 * `onEvent` (le lecteur y bascule sa source : `swapSource`). Muet sans la
 * capacité musique du serveur (`enabled`).
 */

const EVENT_TYPES: ReadonlySet<string> = new Set(MUSIC_EVENT_TYPES);

/** Les clés de `/api/plugins/active` des applications (web et bureau, mobile, TV). */
const ACTIVE_PLUGINS_KEYS: readonly (readonly string[])[] = [["plugins-api", "active-meta"], ["plugins", "active"]];

export function isMusicEvent(msg: { type: string }): msg is MusicEvent {
  return EVENT_TYPES.has(msg.type);
}

export function applyMusicEvent(qc: QueryClient, event: MusicEvent): void {
  if (event.type === "music:pending" || event.type === "music:resolved") {
    void qc.invalidateQueries({ queryKey: musicPendingKey(event.pluginId) });
  } else if (event.type === "music:provider") {
    for (const key of ACTIVE_PLUGINS_KEYS) void qc.invalidateQueries({ queryKey: [...key] });
    void qc.invalidateQueries({ queryKey: ["music"] });
  }
}

export interface UseMusicEventsOptions {
  enabled: boolean;
  /** Auth par message (bureau, mobile, TV) ; undefined = cookie (web). */
  token?: string | null;
  onEvent?: (event: MusicEvent) => void;
}

export function useMusicEvents({ enabled, token, onEvent }: UseMusicEventsOptions): void {
  const qc = useQueryClient();
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const release = acquireSocket(token ?? undefined);
    const off = subscribeSocket((msg) => {
      const typed: { type: string } = msg;
      if (!isMusicEvent(typed)) return;
      applyMusicEvent(qc, typed);
      handler.current?.(typed);
    });
    // Une coupure a pu faire manquer des événements : au retour du socket, toute la musique se relit (une fois).
    let hadOpen = false;
    let previous: SocketStatus | null = null;
    const offStatus = onSocketStatus((status) => {
      if (status === "open" && hadOpen && previous !== "open") void qc.invalidateQueries({ queryKey: ["music"] });
      if (status === "open") hadOpen = true;
      previous = status;
    });
    return () => {
      off();
      offStatus();
      release();
    };
  }, [enabled, token, qc]);
}
