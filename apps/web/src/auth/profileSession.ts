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
 * Chaque bascule recharge la page (`profiles/switch/commitPick.ts`) : l'état
 * lu ici ne change jamais sous les yeux, hors des tests. Hors du bureau, rien
 * n'écrit ces clés : tout répond « session personnelle ». La marque ne vaut
 * que pour la session active de SON profil (`profileMarkerIn`) : un reste
 * laissé par une sortie qui ignorait ces clés ne fait jamais d'un compte un
 * profil.
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
  /** Un invité que la session personnelle de l'appareil peut habiller (photo) ;
   *  absent d'une marque d'avant la 1.30.0. */
  photoEditable?: boolean;
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

/** Le compte (`Id`) d'un `tentacle_user` ; null s'il est absent ou illisible. */
function userIdOf(raw: string | null): string | null {
  try {
    const id = raw ? (JSON.parse(raw) as { Id?: unknown }).Id : null;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * La marque du profil (`tentacle_profile_session`) face à la session ACTIVE :
 *
 * - `none` : aucune marque — la session personnelle ;
 * - `active` : la marque d'un profil, et la session active est la sienne ;
 * - `stale` : la marque d'un profil, mais la session active est celle d'un
 *   AUTRE compte — un reste qu'une sortie passée à côté de ces clés a laissé
 *   (`useAuth().logout`, un changement de serveur, puis une connexion) :
 *   personne ne s'en sert, et la prochaine entrée dans un profil la remplace ;
 * - `unreadable` : une marque illisible.
 */
export type ProfileMarkerState = "none" | "active" | "stale" | "unreadable";

export function profileMarkerIn(store: Pick<Storage, "getItem">): { state: ProfileMarkerState; profile: ActiveProfile | null } {
  const raw = store.getItem(PROFILE_SESSION_KEY);
  if (raw === null) return { state: "none", profile: null };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* illisible */
  }
  if (!isActiveProfile(parsed)) return { state: "unreadable", profile: null };
  if (userIdOf(store.getItem("tentacle_user")) !== parsed.id) return { state: "stale", profile: null };
  return { state: "active", profile: { ...parsed, imageTag: parsed.imageTag ?? null, hasPin: parsed.hasPin === true } };
}

const safeLocalStorage: Pick<Storage, "getItem"> = { getItem: read };

let lastRaw: string | null | undefined;
let lastUser: string | null | undefined;
let lastProfile: ActiveProfile | null = null;

/**
 * Le profil actif, ou null : la session est la session personnelle. Une marque
 * qui n'est pas celle de la session active (`stale`) ne compte pas.
 */
export function readActiveProfile(): ActiveProfile | null {
  const raw = read(PROFILE_SESSION_KEY);
  const user = read("tentacle_user");
  if (raw === lastRaw && user === lastUser) return lastProfile;
  lastRaw = raw;
  lastUser = user;
  lastProfile = profileMarkerIn(safeLocalStorage).profile;
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
  return userIdOf(readActiveProfile() ? readAccountSession()?.user ?? null : read("tentacle_user"));
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

/**
 * La nouvelle photo du profil actif (un invité habillé pendant SA session) : la
 * marque et le `tentacle_user` du profil la portent aussitôt, sans recharger.
 */
export function rememberActiveProfilePhoto(imageTag: string | null): void {
  const profile = readActiveProfile();
  if (!profile) return;
  try {
    localStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify({ ...profile, imageTag }));
    const user = JSON.parse(read("tentacle_user") ?? "null") as Record<string, unknown> | null;
    if (user) {
      const { PrimaryImageTag: _previous, ...rest } = user;
      localStorage.setItem("tentacle_user", JSON.stringify(imageTag ? { ...rest, PrimaryImageTag: imageTag } : rest));
    }
  } catch {
    // Stockage refusé : la photo reviendra au prochain choix du profil.
  }
  notifyProfileSessionChange();
}

/** Les clés de la session de profil : effacées avec elle (déconnexion, changement
 *  de serveur), GARDÉES avec la session active quand on vide le cache. */
export const PROFILE_SESSION_STORAGE_KEYS: readonly string[] = [PROFILE_SESSION_KEY, ACCOUNT_SESSION_KEY];
