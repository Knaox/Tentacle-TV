/**
 * Octave — le cache gardé, lu AU DÉMARRAGE : sur un lancement en Octave, la
 * lecture du disque (IndexedDB) part avec le chargement du module, pendant
 * que le reste démarre ; `main.tsx` attend (bornée) qu'elle et le module
 * d'Octave soient là pour peindre la première image — la page gardée, avec
 * ses données, d'un coup. La porte du cache (`OctaveCacheBoundary`) reprend
 * les entrées déjà lues, de façon SYNCHRONE.
 *
 * Le stockage lui-même est unique ici (tests : `setOctaveCacheBackendForTests`).
 */

import type { StoredEntry } from "../data/persist/octaveCachePolicy";
import { indexedDbBackend, type OctaveCacheBackend } from "../data/persist/octaveCacheStore";

/** Le plus long que la première image attend le disque et le module (au-delà, elle part sans). */
export const OCTAVE_BOOT_BUDGET_MS = 350;

let backend: OctaveCacheBackend | null = null;
let preload: Promise<StoredEntry[]> | null = null;
let preloaded: StoredEntry[] | null = null;
/** Les entrées lues au démarrage ne servent qu'une fois : la suite passe par le disque. */
let taken = false;

export function octaveCacheBackend(): OctaveCacheBackend {
  return (backend ??= indexedDbBackend());
}

/** Pour les tests. */
export function setOctaveCacheBackend(next: OctaveCacheBackend | null): void {
  backend = next;
  preload = null;
  preloaded = null;
  taken = false;
}

/** Lance la lecture du disque (une fois). Tout échec : aucune entrée. */
export function preloadOctaveCache(): Promise<StoredEntry[]> {
  if (!preload) {
    preload = octaveCacheBackend()
      .loadAll()
      .catch(() => [] as StoredEntry[])
      .then((entries) => {
        preloaded = entries;
        return entries;
      });
  }
  return preload;
}

/** Les entrées lues au démarrage, déjà en mémoire (null : pas encore, pas de préchargement, ou déjà remises). */
export function takePreloadedOctaveCache(): StoredEntry[] | null {
  if (taken || preloaded === null) return null;
  taken = true;
  return preloaded;
}

/** La lecture lancée au démarrage et pas encore finie (null : rien à reprendre). */
export function takePendingOctavePreload(): Promise<StoredEntry[]> | null {
  if (taken || !preload) return null;
  taken = true;
  return preload;
}

/** Résolue quand `work` est fini, ou au bout de `budgetMs` (jamais rejetée). */
export function withinBudget(work: Promise<unknown>, budgetMs: number = OCTAVE_BOOT_BUDGET_MS): Promise<void> {
  return Promise.race([
    work.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, budgetMs)),
  ]);
}
