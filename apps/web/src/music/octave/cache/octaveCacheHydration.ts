/**
 * Octave — l'hydratation du cache gardé, une fois par identité et par
 * chargement de la page : les entrées lues au démarrage (`octaveCacheBoot`)
 * reviennent dans le cache de requêtes de façon SYNCHRONE — `main.tsx` le
 * fait avant le premier rendu, aucun observateur n'est encore là — ; sinon
 * la lecture du disque, asynchrone, attendue (bornée) par la porte du cache.
 * Sans React : ce module est dans le lot principal.
 */

import { hydrateOctaveCache, restoreOctaveEntries, type HydrationResult, type OctaveQueryClientLike } from "../data/persist/octaveCachePersister";
import type { OctaveCacheBackend } from "../data/persist/octaveCacheStore";
import { octaveCacheBackend, preloadOctaveCache, setOctaveCacheBackend, takePendingOctavePreload, takePreloadedOctaveCache, withinBudget } from "./octaveCacheBoot";
import { octaveOwner } from "./octaveOwner";

const EMPTY: HydrationResult = { restored: 0, dropped: 0, recent: [], known: [] };
const hydrations = new Map<string, Promise<HydrationResult>>();
const settled = new Set<string>();

/** Pour les tests. */
export function resetOctaveCacheHydration(backend: OctaveCacheBackend | null): void {
  setOctaveCacheBackend(backend);
  hydrations.clear();
  settled.clear();
}

/** L'hydratation de cette identité est faite (la porte peut rendre aussitôt). */
export function isOctaveCacheHydrated(owner: string): boolean {
  return settled.has(owner);
}

export function octaveCacheHydration(qc: OctaveQueryClientLike, owner: string): Promise<HydrationResult> {
  let job = hydrations.get(owner);
  if (job) return job;
  const ready = takePreloadedOctaveCache();
  if (ready) {
    let result = EMPTY;
    try {
      result = restoreOctaveEntries(qc, ready, octaveCacheBackend(), owner);
    } catch {
      /* rien de rendu : Octave s'ouvre comme sans cache */
    }
    settled.add(owner);
    job = Promise.resolve(result);
  } else {
    const pending = takePendingOctavePreload();
    job = (pending ? pending.then((all) => restoreOctaveEntries(qc, all, octaveCacheBackend(), owner)) : hydrateOctaveCache(qc, octaveCacheBackend(), owner)).catch(() => EMPTY);
    job.then(
      () => settled.add(owner),
      () => settled.add(owner),
    );
  }
  hydrations.set(owner, job);
  return job;
}

/**
 * Le démarrage en Octave, côté cache (`main.tsx`) : attendre au plus
 * `OCTAVE_BOOT_BUDGET_MS` la lecture du disque ET ce que l'appelant attend
 * d'autre (le module d'Octave), puis rendre les pages de l'identité dans le
 * cache — avant le premier rendu. Au-delà du budget, la porte reprendra la
 * lecture quand elle finira.
 */
export async function bootOctaveCache(qc: OctaveQueryClientLike, alongside: Promise<unknown>): Promise<void> {
  const owner = octaveOwner();
  if (owner === null) return;
  await withinBudget(Promise.all([preloadOctaveCache(), alongside]));
  // Lecture finie : rendue dans ce tour (synchrone). Sinon, reprise quand elle finira.
  void octaveCacheHydration(qc, owner);
}
