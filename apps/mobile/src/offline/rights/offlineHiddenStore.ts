/**
 * Les titres gardés que le serveur a jugés cachés à l'identité en session —
 * tenus dans la base locale (table `settings` : ils survivent à « Vider le
 * cache », comme les titres eux-mêmes), relus une fois puis gardés en mémoire.
 * Règle : `@tentacle-tv/offline-core` › `rights/offlineHidden`.
 *
 * La façade du moteur (`engineApi.ts`) les retire de la liste, de l'état d'un
 * titre et des sources de lecture : un titre caché ne se lit plus, même hors
 * ligne, même gardé avant le retrait du droit.
 */

import {
  OFFLINE_HIDDEN_SETTING_KEY,
  applyOfflineVerdict,
  isOfflineHidden,
  parseOfflineHidden,
  sameOfflineHidden,
  withoutOfflineHidden,
  type OfflineHiddenMap,
} from "@tentacle-tv/offline-core";
import type { LibraryVisibilityDto } from "@tentacle-tv/shared";

export interface HiddenStoreBackend {
  read: () => string | null;
  write: (value: string) => void;
  /** Les écrans du hors ligne relisent (liste, fiche locale). */
  changed: () => void;
}

let backend: HiddenStoreBackend | null = null;
let map: OfflineHiddenMap | null = null;

/** Branché par la façade du moteur (base locale, avis de changement) ; les tests y posent le leur. */
export function configureOfflineHidden(next: HiddenStoreBackend): void {
  backend = next;
  map = null;
}

function current(): OfflineHiddenMap {
  if (map !== null) return map;
  try {
    map = parseOfflineHidden(backend?.read() ?? null);
  } catch {
    // Base pas encore ouverte : rien de caché connu, on relira.
    return {};
  }
  return map;
}

/** Le verdict du serveur pour cette identité ; vrai s'il a changé quelque chose. */
export function recordOfflineVerdict(identity: string, verdict: LibraryVisibilityDto): boolean {
  const before = current();
  const next = applyOfflineVerdict(before, identity, verdict);
  if (sameOfflineHidden(before, next)) return false;
  map = next;
  backend?.write(JSON.stringify(next));
  backend?.changed();
  return true;
}

export function isHiddenOffline(identity: string | null | undefined, itemId: string): boolean {
  return isOfflineHidden(current(), identity, itemId);
}

export function filterHiddenOffline<T extends { itemId: string }>(identity: string | null | undefined, entries: readonly T[]): T[] {
  return withoutOfflineHidden(current(), identity, entries);
}

export { OFFLINE_HIDDEN_SETTING_KEY };
