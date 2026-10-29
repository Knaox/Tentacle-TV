import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  applyNotificationPatch,
  NOTIFICATION_MUTATION_KEY,
  restoreNotificationSnapshot,
  settleNotifications,
} from "../notifications/notificationCache";
import type { FamilyNotificationType, NotificationState, NotificationTarget } from "@tentacle-tv/shared";

let _backendBase = "/api/notifications";

export function setNotificationsBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/notifications`;
}

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** La racine du serveur Tentacle (vide sur le web : même origine). */
export function notificationsBackendRoot(): string {
  return _backendBase.replace(/\/api\/notifications$/, "");
}

/** Un appel au serveur Tentacle avec la même authentification que la cloche. */
export function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return rawFetch<T>(`${notificationsBackendRoot()}${path}`, init);
}

function notifFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return rawFetch<T>(`${_backendBase}${path}`, init);
}

async function rawFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  // Only set Content-Type when there's a body (Fastify rejects empty JSON bodies with 400)
  if (init?.body) headers["Content-Type"] = "application/json";
  // Use credentials: "include" (cookies) only on web (no Bearer token in localStorage).
  // Desktop/mobile send the token via Authorization header — cookies don't work cross-origin.
  const hasToken = !!localStorage.getItem("tentacle_token");
  const res = await fetch(url, { ...init, headers, credentials: hasToken ? undefined : "include" });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface AppNotification {
  id: string;
  jellyfinUserId: string;
  type:
    | "ticket_reply"
    | "ticket_status"
    | "ticket_new"
    | "ticket_user_reply"
    | "ticket_user_closed"
    | "request_status"
    | "watchlist_share"
    /** Octave : `title` = la playlist partagée, `body` = qui la partage. */
    | "music_playlist_shared"
    /** La Famille (`FAMILY_NOTIFICATION_TYPES`) : `title` = le nom de l'autre. */
    | FamilyNotificationType;
  title: string;
  body: string | null;
  refId: string | null;
  /** Où mène la notification (contrat shared `notificationTarget`) ; absente d'un serveur d'avant 1.30.0. */
  target?: NotificationTarget | null;
  /** L'état de ce dont elle parle — une pastille ; absent = aucune. */
  state?: NotificationState | null;
  read: boolean;
  createdAt: string;
}

// ---------- Hooks ----------

export function useNotifications(limit = 20) {
  const hasToken = typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));

  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () => notifFetch<AppNotification[]>(`/?limit=${limit}`),
    enabled: hasToken,
    staleTime: 15_000,
    refetchInterval: 30_000, // Poll every 30s
  });
}

export function useUnreadCount() {
  const hasToken = typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notifFetch<{ count: number }>("/unread-count"),
    enabled: hasToken,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

// Lire ou supprimer se voit tout de suite (le point disparaît au clic) ; le serveur suit.
// Le cache optimiste est celui du mobile aussi (`notifications/notificationCache`) : le mobile
// passe ses propres requêtes à `useNotificationMutation`.
export function useNotificationMutation<V>(request: (vars: V) => Promise<unknown>, patch: (vars: V) => Parameters<typeof applyNotificationPatch>[1]) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: NOTIFICATION_MUTATION_KEY,
    mutationFn: request,
    onMutate: (vars: V) => applyNotificationPatch(qc, patch(vars)),
    onError: (_err, _vars, snapshot) => { if (snapshot) restoreNotificationSnapshot(qc, snapshot); },
    onSettled: () => settleNotifications(qc),
  });
}

export function useMarkAllRead() {
  return useNotificationMutation<void>(
    () => notifFetch<{ success: boolean }>("/read-all", { method: "POST" }),
    () => ({ read: () => true, allRead: true }),
  );
}

export function useMarkRead() {
  return useNotificationMutation<string>(
    (id) => notifFetch<{ success: boolean }>(`/${id}/read`, { method: "POST" }),
    (id) => ({ read: (n) => n.id === id }),
  );
}

export function useDeleteNotification() {
  return useNotificationMutation<string>(
    (id) => notifFetch<{ deleted: number }>(`/${id}`, { method: "DELETE" }),
    (id) => ({ remove: (n) => n.id === id }),
  );
}

export function useDeleteNotifications() {
  return useNotificationMutation<string[]>(
    (ids) => notifFetch<{ deleted: number }>("/batch", { method: "DELETE", body: JSON.stringify({ ids }) }),
    (ids) => { const set = new Set(ids); return { remove: (n) => set.has(n.id) }; },
  );
}

export function useDeleteAllNotifications() {
  return useNotificationMutation<void>(
    () => notifFetch<{ deleted: number }>("/all", { method: "DELETE" }),
    () => ({ remove: () => true, allRemoved: true }),
  );
}
