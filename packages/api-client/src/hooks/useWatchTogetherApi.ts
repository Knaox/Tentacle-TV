import { useQuery } from "@tanstack/react-query";
import type { WtElsewhereDto, WtInvitableUserDto, WtInviteDto, WtRoomStateDto } from "@tentacle-tv/shared";

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

/** Jeton posé par une plateforme sans localStorage (mobile) — sinon celui du
 *  stockage du web/bureau, sinon le cookie. */
let _token: string | null = null;

export function setWatchTogetherToken(token: string | null) {
  _token = token;
}

function currentToken(): string | null {
  if (_token) return _token;
  return typeof localStorage !== "undefined" ? localStorage.getItem("tentacle_token") : null;
}

function getAuthHeader(): Record<string, string> {
  const token = currentToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** La racine du serveur Tentacle (vide sur le web : même origine) et
 *  l'authentification de Watch Together — pour ses routes hors du préfixe
 *  (`/api/gifs` du chat). */
export function wtBackendRoot(): string {
  return _backendBase.replace(/\/api\/watch-together$/, "");
}

/** L'authentification d'un appel : le jeton s'il y en a un (bureau, mobile),
 *  sinon le cookie (web) — comme `wtFetch`. */
export function wtAuthInit(): Pick<RequestInit, "headers" | "credentials"> {
  return { headers: getAuthHeader(), credentials: currentToken() ? undefined : "include" };
}

/** Appel REST authentifié sous /api/watch-together (partagé avec l'affinité). */
export async function wtFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const hasToken = !!currentToken();
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
    // Serveur d'avant : « pas de groupe » y répondait 404. Le nouveau rend
    // 200 + `null` — les deux se lisent pareil ici.
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

/** Adhésion par appareil (1.32.0) : la salle du compte, vue d'un appareil qui
 *  n'y est pas lié — `null` s'il y est, ou s'il n'y a pas de salle. */
export function fetchGroupElsewhere(): Promise<WtElsewhereDto | null> {
  return wtFetch<WtElsewhereDto | null>("/group/elsewhere");
}

/** « Rejoindre ici » : AJOUTE cet appareil à la salle de son compte. */
export function joinGroupHere(): Promise<WtRoomStateDto> {
  return wtFetch<WtRoomStateDto>("/group/join-here", { method: "POST", body: JSON.stringify({}) });
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
