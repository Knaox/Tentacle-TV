import { useSyncExternalStore } from "react";

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

import {
  ACCOUNT_SESSION_KEY,
  PROFILE_SESSION_KEY,
  PROFILE_SESSION_STORAGE_KEYS,
  accountSessionIn,
  profileMarkerIn,
  storedUserIdOf,
  type AccountSession,
  type ActiveProfile,
  type ProfileMarkerState,
} from "@tentacle-tv/shared";

// Le pur (clés, marque, réserve) est partagé avec le mobile : `@tentacle-tv/shared` › `family/profileSessionStore.ts`.
export { ACCOUNT_SESSION_KEY, PROFILE_SESSION_KEY, PROFILE_SESSION_STORAGE_KEYS, profileMarkerIn };
export type { AccountSession, ActiveProfile, ProfileMarkerState };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
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
  return accountSessionIn(safeLocalStorage);
}

/** Le jeton de la session PERSONNELLE : celui mis de côté pendant un profil, sinon le jeton actif. */
export function accountToken(): string | null {
  if (readActiveProfile()) return readAccountSession()?.token ?? null;
  return read("tentacle_token");
}

/** Le compte de l'application (celui qui s'y est connecté), même pendant un profil. */
export function accountUserId(): string | null {
  return storedUserIdOf(readActiveProfile() ? readAccountSession()?.user ?? null : read("tentacle_user"));
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

