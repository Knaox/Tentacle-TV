import { useQuery, useMutation } from "@tanstack/react-query";
import { PAIRING_RELAY_URL } from "@tentacle-tv/shared";

// ---------- Types ----------

export interface RelayGenerateResponse {
  code: string;
  expiresIn: number;
}

export interface RelayStatusResponse {
  status: "pending" | "confirmed" | "expired";
  serverUrl?: string;
  token?: string;
  user?: { id: string; name: string };
}

export interface RelayConfirmPayload {
  code: string;
  serverUrl: string;
  token: string;
  user: { id: string; name: string };
}

// ---------- Fetcher ----------

async function relayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${PAIRING_RELAY_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ---------- Hooks ----------

/** TV calls this to generate a code on the relay. */
export function useRelayGenerate() {
  return useMutation({
    mutationFn: () =>
      relayFetch<RelayGenerateResponse>("/generate", { method: "POST" }),
  });
}

/** TV polls this every 3s to check if the code was confirmed. */
export function useRelayStatus(code: string | null) {
  return useQuery({
    queryKey: ["relay-status", code],
    queryFn: () => relayFetch<RelayStatusResponse>(`/status/${code}`),
    enabled: !!code,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: 5000,
  });
}

/** Web/mobile calls this to confirm a code with server info. */
export function useRelayConfirm() {
  return useMutation({
    mutationFn: (data: RelayConfirmPayload) =>
      relayFetch<{ success: boolean }>("/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
