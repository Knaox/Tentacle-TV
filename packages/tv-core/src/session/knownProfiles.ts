import { sameUserId } from "@tentacle-tv/shared";
import { TV_KNOWN_PROFILES_KEY } from "./tvProfileKeys";
import type { SessionStorage } from "./unpairJournal";

/**
 * Les profils déjà vus par cette TV. Certains réglages d'un profil vivent sur
 * l'APPAREIL, rangés par son identifiant (l'avance rapide :
 * `tentacle_scrub_countdown:<id>`) : quand un profil quitte la famille —
 * retiré, invité supprimé —, la TV les efface à la lecture suivante de « Qui
 * regarde ? ». Module pur, stockage injecté.
 */

export function readKnownProfiles(storage: SessionStorage): string[] {
  const raw = storage.getItem(TV_KNOWN_PROFILES_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && id !== "") : [];
  } catch {
    return [];
  }
}

/**
 * Retient les profils de la liste lue et rend ceux qui en sont SORTIS depuis
 * (leurs réglages d'appareil sont à effacer).
 */
export function rememberProfiles(storage: SessionStorage, current: readonly string[]): string[] {
  const known = readKnownProfiles(storage);
  const gone = known.filter((id) => !current.some((other) => sameUserId(other, id)));
  storage.setItem(TV_KNOWN_PROFILES_KEY, JSON.stringify([...current]));
  return gone;
}
