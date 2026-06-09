import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * « Partager ma liste » — hooks du lien de partage.
 * Base `/api/share` (web same-origin) ou URL backend explicite (React Native).
 */

let _backendBase = "/api/share";
let _tokenOverride: string | null = null;

export function setShareLinkBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/share`;
}

export function setShareLinkToken(token: string | null) {
  _tokenOverride = token;
}

function getToken(): string | null {
  return _tokenOverride
    ?? (typeof localStorage !== "undefined" ? localStorage.getItem("tentacle_token") : null);
}

async function shareFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers,
    credentials: token ? undefined : "include",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

export interface SharedListItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  ImageTags?: Record<string, string>;
}

export interface SharedListData {
  ownerUsername: string;
  items: SharedListItem[];
}

/** Crée (ou récupère) mon lien de partage. */
export function useCreateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shareFetch<{ token: string }>("/", { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["share", "mine"] }),
  });
}

/** État de mon lien (token ou null). */
export function useMyShareLink(enabled = true) {
  return useQuery({
    queryKey: ["share", "mine"],
    queryFn: () => shareFetch<{ token: string | null }>("/mine"),
    enabled,
    staleTime: 30_000,
  });
}

/** Révoque mon lien. */
export function useRevokeShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shareFetch<{ ok: boolean }>("/", { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["share", "mine"] }),
  });
}

/** Vue PUBLIQUE d'une liste partagée (lecture seule, sans auth requise). */
export function useSharedListView(token: string | null | undefined) {
  return useQuery({
    queryKey: ["share", "view", token],
    queryFn: () => shareFetch<SharedListData>(`/${token}`),
    enabled: !!token,
    staleTime: 30_000,
    retry: false,
  });
}

/** Détail PUBLIC d'un média de la liste partagée (résumé + bandes-annonces). */
export function useSharedItem(token: string | null | undefined, itemId: string | null | undefined) {
  return useQuery({
    queryKey: ["share", "item", token, itemId],
    queryFn: () => shareFetch<MediaItem>(`/${token}/item/${itemId}`),
    enabled: !!token && !!itemId,
    staleTime: 60_000,
    retry: false,
  });
}
