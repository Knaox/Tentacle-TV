import { useQuery } from "@tanstack/react-query";
import type { WtInvitableUserDto, WtInviteDto, WtRoomStateDto } from "@tentacle-tv/shared";

/**
 * Watch Together — accès REST au backend (composition du groupe).
 * L'état temps réel (lecture, membres) arrive par le socket partagé ; ici on ne
 * trouve que les mutations de composition et la liste des invitables.
 */

let _backendBase = "/api/watch-together";

export function setWatchTogetherBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/watch-together`;
}

/** Erreur API portant le code métier du backend (already_in_group, not_host…). */
export class WtApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null, message?: string) {
    super(message ?? code ?? `HTTP ${status}`);
    this.name = "WtApiError";
    this.status = status;
    this.code = code;
  }
}

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function wtFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers,
    credentials: hasToken ? undefined : "include",
  });
  if (!res.ok) {
    let code: string | null = null;
    let message: string | undefined;
    try {
      const body = (await res.json()) as { code?: string; message?: string };
      code = body.code ?? null;
      message = body.message;
    } catch { /* corps non-JSON */ }
    throw new WtApiError(res.status, code, message);
  }
  return res.json();
}

// ── Fonctions directes (consommées par le WatchTogetherProvider) ──

/** Groupe courant, ou null si l'utilisateur n'est dans aucun groupe. */
export async function fetchMyGroup(): Promise<WtRoomStateDto | null> {
  try {
    return await wtFetch<WtRoomStateDto>("/group");
  } catch (err) {
    if (err instanceof WtApiError && err.status === 404) return null;
    throw err;
  }
}

export function fetchMyInvites(): Promise<WtInviteDto[]> {
  return wtFetch<WtInviteDto[]>("/invites");
}

export function createGroup(itemId?: string): Promise<WtRoomStateDto> {
  return wtFetch<WtRoomStateDto>("/group", {
    method: "POST",
    body: JSON.stringify(itemId ? { itemId } : {}),
  });
}

export function sendGroupInvites(userIds: string[]): Promise<{ invited: string[] }> {
  return wtFetch<{ invited: string[] }>("/group/invites", {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });
}

/** Accepter renvoie l'état du groupe rejoint ; refuser renvoie {success}. */
export function respondToInvite(
  inviteId: string,
  accept: boolean,
): Promise<WtRoomStateDto | { success: true }> {
  return wtFetch<WtRoomStateDto | { success: true }>(
    `/invites/${encodeURIComponent(inviteId)}/respond`,
    { method: "POST", body: JSON.stringify({ accept }) },
  );
}

export function leaveGroup(): Promise<{ success: boolean }> {
  return wtFetch<{ success: boolean }>("/group/leave", { method: "POST", body: JSON.stringify({}) });
}

export function kickGroupMember(userId: string): Promise<{ success: boolean }> {
  return wtFetch<{ success: boolean }>("/group/kick", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

// ── Hooks TanStack ──

/** Utilisateurs invitables (id, nom, avatar, présence) — pour la modale d'invitation. */
export function useInvitableUsers(enabled = true) {
  return useQuery({
    queryKey: ["wt-invitable-users"],
    queryFn: () => wtFetch<WtInvitableUserDto[]>("/users"),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}
