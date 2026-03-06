import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import type { AppNotification } from "@tentacle-tv/api-client";

function useNotifFetch() {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";

  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string>),
    };
    if (init?.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`${serverUrl}/api/notifications${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };
}

export function useNotificationsMobile(limit = 20) {
  const fetcher = useNotifFetch();
  const { storage } = useTentacleConfig();
  const hasToken = !!storage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () => fetcher<AppNotification[]>(`/?limit=${limit}`),
    enabled: hasToken,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useUnreadCountMobile() {
  const fetcher = useNotifFetch();
  const { storage } = useTentacleConfig();
  const hasToken = !!storage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => fetcher<{ count: number }>("/unread-count"),
    enabled: hasToken,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMarkAllReadMobile() {
  const qc = useQueryClient();
  const fetcher = useNotifFetch();

  return useMutation({
    mutationFn: () => fetcher<{ success: boolean }>("/read-all", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });
}

export function useMarkReadMobile() {
  const qc = useQueryClient();
  const fetcher = useNotifFetch();

  return useMutation({
    mutationFn: (id: string) => fetcher<{ success: boolean }>(`/${id}/read`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });
}
