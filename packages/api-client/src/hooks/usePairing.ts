import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/pair";
let _tokenOverride: string | null = null;

export function setPairingBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/pair`;
}

/**
 * Set auth token for non-web platforms (React Native) where localStorage is
 * unavailable. Without this, mobile requests to /my-devices etc. went out with
 * NO Authorization header — the paired-devices list came back empty and
 * revocation silently 401'd.
 */
export function setPairingToken(token: string | null) {
  _tokenOverride = token;
}

function getAuthHeader(): Record<string, string> {
  const token =
    _tokenOverride
    ?? (typeof localStorage !== "undefined"
      ? localStorage.getItem("tentacle_token")
      : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function pairFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const hasToken = !!(_tokenOverride || (typeof localStorage !== "undefined" && localStorage.getItem("tentacle_token")));
  const res = await fetch(`${_backendBase}${path}`, { ...init, headers, credentials: hasToken ? undefined : "include" });
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

// ---------- Flux « appareil » (manuel, sans relay) ----------
// La TV affiche un code généré par le serveur configuré ; l'utilisateur le
// confirme depuis le téléphone/web connecté. Miroir du flux relay, en local.

export interface DevicePairGenerateResponse {
  code: string;
  expiresIn: number;
}

export interface DevicePairStatusResponse {
  status: "pending" | "confirmed" | "expired";
  token?: string;
  user?: { id: string; name: string };
}

/** TV : génère un code de jumelage sur le serveur configuré (sans auth). */
export function useDevicePairGenerate() {
  return useMutation({
    mutationFn: (data?: { deviceName?: string }) =>
      pairFetch<DevicePairGenerateResponse>("/device/generate", {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
  });
}

/** TV : poll toutes les 3s pour savoir si le code a été confirmé. */
export function useDevicePairStatus(code: string | null) {
  return useQuery({
    queryKey: ["device-pair-status", code],
    queryFn: () => pairFetch<DevicePairStatusResponse>(`/device/status/${code}`),
    enabled: !!code,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: 5000,
  });
}

/** Téléphone/web : confirme le code affiché par la TV (auth requise). */
export function useDevicePairConfirm() {
  return useMutation({
    mutationFn: (data: { code: string }) =>
      pairFetch<{ success: boolean; deviceName?: string }>("/device/confirm", {
        method: "POST",
        body: JSON.stringify({ code: data.code.toUpperCase() }),
      }),
  });
}

// ---------- TV Token (relay flow) ----------

export interface TvTokenResponse {
  token: string;
}

/** Generate a long-lived TV token (web/mobile, requires auth) */
export function useGenerateTvToken() {
  return useMutation({
    mutationFn: () =>
      pairFetch<TvTokenResponse>("/tv-token", { method: "POST" }),
  });
}

/** List current user's paired devices */
export function useMyPairedDevices() {
  return useQuery({
    queryKey: ["my-paired-devices"],
    queryFn: () => pairFetch<PairedDevice[]>("/my-devices"),
    staleTime: 30_000,
  });
}

/** Revoke own paired device (non-admin) */
export function useRevokeMyDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      pairFetch<{ success: boolean }>(`/my-devices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-paired-devices"] });
    },
  });
}
