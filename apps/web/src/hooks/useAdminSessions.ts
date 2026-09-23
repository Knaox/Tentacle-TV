import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminGroupActionResultDto,
  AdminPlaystateCommand,
  AdminSessionsSnapshotDto,
} from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../pages/adminUtils";

/**
 * Le tableau de bord des sessions : l'instantané du backend, relu toutes les
 * trois secondes TANT QUE la page est visible (react-query suspend la relève
 * d'un onglet caché), et les actions. Le backend sert l'instantané depuis
 * mémoire — la relève ne coûte rien à Jellyfin.
 */

export const ADMIN_SESSIONS_KEY = ["admin", "sessions"] as const;
const REFRESH_MS = 3_000;

async function request<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BACKEND}/api/admin${path}`, {
    method: init?.method ?? "GET",
    headers: hdrs(),
    credentials: creds(),
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface SnapshotWithClock extends AdminSessionsSnapshotDto {
  /** Horloge du serveur moins la nôtre, à la réception (ms). */
  clockOffsetMs: number;
}

export function useAdminSessions() {
  return useQuery<SnapshotWithClock>({
    queryKey: ADMIN_SESSIONS_KEY,
    queryFn: async () => {
      const snapshot = await request<AdminSessionsSnapshotDto>("/sessions");
      return { ...snapshot, clockOffsetMs: snapshot.serverTime - Date.now() };
    },
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

export interface MessageInput {
  header: string;
  text: string;
  timeoutMs?: number;
}

export function useAdminSessionActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_SESSIONS_KEY });

  const playstate = useMutation({
    mutationFn: ({ sessionId, command }: { sessionId: string; command: AdminPlaystateCommand }) =>
      request<{ ok: boolean }>(`/sessions/${encodeURIComponent(sessionId)}/playstate`, { method: "POST", body: { command } }),
    onSettled: refresh,
  });

  const message = useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: MessageInput }) =>
      request<{ ok: boolean }>(`/sessions/${encodeURIComponent(sessionId)}/message`, { method: "POST", body: input }),
  });

  const groupMessage = useMutation({
    mutationFn: ({ groupId, input }: { groupId: string; input: MessageInput }) =>
      request<AdminGroupActionResultDto>(`/watch-groups/${encodeURIComponent(groupId)}/message`, { method: "POST", body: input }),
  });

  const groupStop = useMutation({
    mutationFn: ({ groupId }: { groupId: string }) =>
      request<AdminGroupActionResultDto>(`/watch-groups/${encodeURIComponent(groupId)}/stop`, { method: "POST" }),
    onSettled: refresh,
  });

  return { playstate, message, groupMessage, groupStop };
}

/**
 * L'heure, relue chaque seconde tant que la page est visible : c'est elle qui
 * fait avancer les barres de progression entre deux instantanés. Onglet
 * caché, plus aucun rendu.
 */
export function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null && document.visibilityState === "visible") {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), 1_000);
      }
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);
  return now;
}
