import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/pair";

export function setPairingBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/pair`;
}

function getAuthHeader(): Record<string, string> {
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("tentacle_token")
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function pairFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${_backendBase}${path}`, { ...init, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export interface PairingStatusResponse {
  status: "pending" | "confirmed" | "expired";
  deviceName?: string;
}

export interface ClaimResponse {
  token: string;
  userId: string;
  username: string;
  serverUrl: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  username: string;
  jellyfinUserId: string;
  lastSeen: string;
  createdAt: string;
}

// ---------- Hooks ----------

/** Generate a pairing code (used by web app, requires auth) */
export function useGeneratePairingCode() {
  return useMutation({
    mutationFn: (data?: { deviceName?: string }) =>
      pairFetch<PairingCodeResponse>("/generate", {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
  });
}

/** Poll pairing status — web checks if TV claimed the code (requires auth, 3s interval) */
export function usePairingStatus(code: string | null) {
  return useQuery({
    queryKey: ["pairing-status", code],
    queryFn: () => pairFetch<PairingStatusResponse>(`/status/${code}`),
    enabled: !!code,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    retry: false,
  });
}

/** Claim a pairing code — TV sends code and gets token (no auth required) */
export function useClaimPairingCode() {
  return useMutation({
    mutationFn: (data: { code: string; deviceName?: string }) =>
      pairFetch<ClaimResponse>("/claim", {
        method: "POST",
        body: JSON.stringify({ code: data.code.toUpperCase(), deviceName: data.deviceName }),
      }),
  });
}

/** List all paired devices (admin) */
export function usePairedDevices() {
  return useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => pairFetch<PairedDevice[]>("/devices"),
    staleTime: 30_000,
  });
}

/** Revoke a paired device (admin) */
export function useRevokePairedDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      pairFetch<{ success: boolean }>(`/devices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paired-devices"] });
    },
  });
}
