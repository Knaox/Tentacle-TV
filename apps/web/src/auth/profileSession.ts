import { useSyncExternalStore } from "react";
import type { FamilyProfileColor, FamilyProfileKind } from "@tentacle-tv/shared";

/**
 * La SESSION DE PROFIL du bureau — l'application ouverte au nom d'un autre
 * profil de la famille que le compte qui s'y est connecté (docs/FAMILLE.md,
 * « Le bureau »). État côté client (stockage local), comme « Voir en tant
 * que » (`lib/impersonation.ts`) :
 *
 * - `tentacle_token` / `tentacle_user` : la session ACTIVE, lue partout — le
 *   jeton du profil et son compte ;
 * - `tentacle_account_session` : la session PERSONNELLE du compte de
 *   l'application, mise de côté le temps du profil — c'est elle qui liste les
 *   profils et en ouvre un, et elle qu'on retrouve en revenant à soi ;
 * - `tentacle_profile_session` : la marque du profil actif (nom, couleur,
 *   rôle), qui dit à l'interface ce qu'elle doit taire.
 *
 * Chaque bascule recharge la page (`profileSwitch.ts`) : l'état lu ici ne
 * change jamais sous les yeux, hors des tests. Hors du bureau, rien n'écrit
 * ces clés : tout répond « session personnelle ».
 *
 * ⚠️ Ces clés sont traversées par une chaîne : jamais renommées.
 */

export const PROFILE_SESSION_KEY = "tentacle_profile_session";
export const ACCOUNT_SESSION_KEY = "tentacle_account_session";

/** Le profil dont la session est active. */
export interface ActiveProfile {
  /** Le compte Jellyfin du profil. */
  id: string;
  name: string;
  kind: FamilyProfileKind;
  color: FamilyProfileColor;
  imageTag: string | null;
  hasPin: boolean;
}

/** La session personnelle mise de côté : son jeton, et son `tentacle_user` tel quel. */
export interface AccountSession {
  token: string;
  user: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isActiveProfile(value: unknown): value is ActiveProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ActiveProfile>;
  return typeof candidate.id === "string" && !!candidate.id && typeof candidate.name === "string"
    && typeof candidate.kind === "string" && typeof candidate.color === "string";
}

let lastRaw: string | null | undefined;
let lastProfile: ActiveProfile | null = null;

/** Le profil actif, ou null : la session est la session personnelle. */
export function readActiveProfile(): ActiveProfile | null {
  const raw = read(PROFILE_SESSION_KEY);
  if (raw === lastRaw) return lastProfile;
  lastRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    lastProfile = isActiveProfile(parsed) ? { ...parsed, imageTag: parsed.imageTag ?? null, hasPin: parsed.hasPin === true } : null;
  } catch {
    lastProfile = null;
  }
  return lastProfile;
}

/** La session personnelle mise de côté pendant un profil ; null sinon. */
export function readAccountSession(): AccountSession | null {
  try {
    const parsed = JSON.parse(read(ACCOUNT_SESSION_KEY) ?? "null") as Partial<AccountSession> | null;
    return parsed && typeof parsed.token === "string" && parsed.token && typeof parsed.user === "string" ? { token: parsed.token, user: parsed.user } : null;
  } catch {
    return null;
  }
}

/** Le jeton de la session PERSONNELLE : celui mis de côté pendant un profil, sinon le jeton actif. */
export function accountToken(): string | null {
  if (readActiveProfile()) return readAccountSession()?.token ?? null;
  return read("tentacle_token");
}

/** Le compte de l'application (celui qui s'y est connecté), même pendant un profil. */
export function accountUserId(): string | null {
  const raw = readActiveProfile() ? readAccountSession()?.user ?? null : read("tentacle_user");
  try {
    const id = raw ? (JSON.parse(raw) as { Id?: unknown }).Id : null;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

/** À appeler après toute écriture des clés (les tests ; la page, elle, se recharge). */
export function notifyProfileSessionChange(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Le profil actif, réactif ; null en session personnelle (et partout hors du bureau). */
export function useActiveProfile(): ActiveProfile | null {
  return useSyncExternalStore(subscribe, readActiveProfile, () => null);
}

/** Les clés de la session de profil, effacées avec la session (déconnexion, changement de serveur). */
export const PROFILE_SESSION_STORAGE_KEYS: readonly string[] = [PROFILE_SESSION_KEY, ACCOUNT_SESSION_KEY];
