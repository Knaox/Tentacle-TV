import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "@tentacle-tv/api-client";
import type {
  AdminGroupActionResultDto,
  AdminPlaystateCommand,
  AdminSessionsSnapshotDto,
} from "@tentacle-tv/shared";

/**
 * Le tableau de bord des sessions, côté mobile — les mêmes routes que le web
 * (`/api/admin/sessions`, réservées aux administrateurs). L'instantané est
 * relu toutes les trois secondes TANT QUE l'écran est à l'avant et l'app au
 * premier plan (le `focusManager` de l'app suit l'AppState) : ailleurs, plus
 * une requête. Le serveur le sert depuis sa mémoire — la relève ne coûte rien
 * à Jellyfin.
 */

export const ADMIN_SESSIONS_KEY = ["admin", "sessions"] as const;
const REFRESH_MS = 3_000;

export interface SnapshotWithClock extends AdminSessionsSnapshotDto {
  /** Horloge du serveur moins la nôtre, à la réception (ms). */
  clockOffsetMs: number;
}

export interface MessageInput {
  header: string;
  text: string;
  timeoutMs?: number;
}

const post = <T,>(path: string, body?: unknown) =>
  tentacleApiFetch<T>(`/api/admin${path}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export function useAdminSessions(active: boolean) {
  return useQuery<SnapshotWithClock>({
    queryKey: ADMIN_SESSIONS_KEY,
    queryFn: async ({ signal }) => {
      const snapshot = await tentacleApiFetch<AdminSessionsSnapshotDto>("/api/admin/sessions", { signal });
      return { ...snapshot, clockOffsetMs: snapshot.serverTime - Date.now() };
    },
    refetchInterval: active ? REFRESH_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

export function useAdminSessionActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_SESSIONS_KEY });

  const playstate = useMutation({
    mutationFn: ({ sessionId, command }: { sessionId: string; command: AdminPlaystateCommand }) =>
      post<{ ok: boolean }>(`/sessions/${encodeURIComponent(sessionId)}/playstate`, { command }),
    onSettled: refresh,
  });
  const message = useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: MessageInput }) =>
      post<{ ok: boolean }>(`/sessions/${encodeURIComponent(sessionId)}/message`, input),
  });
  const groupMessage = useMutation({
    mutationFn: ({ groupId, input }: { groupId: string; input: MessageInput }) =>
      post<AdminGroupActionResultDto>(`/watch-groups/${encodeURIComponent(groupId)}/message`, input),
  });
  const groupStop = useMutation({
    mutationFn: ({ groupId }: { groupId: string }) =>
      post<AdminGroupActionResultDto>(`/watch-groups/${encodeURIComponent(groupId)}/stop`),
    onSettled: refresh,
  });

  return { playstate, message, groupMessage, groupStop };
}

/**
 * L'heure, relue chaque seconde tant que `active` et l'app au premier plan :
 * c'est elle qui fait avancer les barres de progression entre deux
 * instantanés. En arrière-plan, plus aucun rendu.
 */
export function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  const [foreground, setForeground] = useState(() => AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!active || !foreground) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active, foreground]);
  return now;
}
