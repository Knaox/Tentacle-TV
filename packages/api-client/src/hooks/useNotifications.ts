import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

async function notifFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  // Only set Content-Type when there's a body (Fastify rejects empty JSON bodies with 400)
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${_backendBase}${path}`, { ...init, headers });
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
  type: "ticket_reply" | "ticket_status" | "request_status";
  title: string;
  body: string | null;
  refId: string | null;
  read: boolean;
  createdAt: string;
}

// ---------- Hooks ----------

export function useNotifications(limit = 20) {
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () => notifFetch<AppNotification[]>(`/?limit=${limit}`),
    enabled: hasToken,
    staleTime: 15_000,
    refetchInterval: 30_000, // Poll every 30s
  });
}

export function useUnreadCount() {
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notifFetch<{ count: number }>("/unread-count"),
    enabled: hasToken,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notifFetch<{ success: boolean }>("/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notifFetch<{ success: boolean }>(`/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
