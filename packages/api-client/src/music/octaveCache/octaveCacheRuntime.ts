/**
 * Octave — le cache gardé AU DÉMARRAGE, commun au web et au mobile : la lecture
 * du disque part au plus tôt (lancement en Octave), la première image l'attend
 * au plus `OCTAVE_BOOT_BUDGET_MS`, puis les pages de l'identité reviennent dans
 * le cache de requêtes de façon SYNCHRONE — une seule hydratation par identité
 * et par chargement du JavaScript. Le stockage est un PORT
 * (`configureOctaveCacheBackend`) : IndexedDB sur le web, SQLite sur le mobile.
 */

import type { StoredEntry } from "./octaveCachePolicy";
import { memoryBackend, type OctaveCacheBackend } from "./octaveCacheBackend";
import { hydrateOctaveCache, restoreOctaveEntries, type HydrationResult, type OctaveQueryClientLike } from "./octaveCachePersister";

/** Le plus long que la première image attend le disque (au-delà, elle part sans). */
export const OCTAVE_BOOT_BUDGET_MS = 350;

let factory: () => OctaveCacheBackend = () => memoryBackend();
let backend: OctaveCacheBackend | null = null;
let preload: Promise<StoredEntry[]> | null = null;
let preloaded: StoredEntry[] | null = null;
/** Les entrées lues au démarrage ne servent qu'une fois : la suite passe par le disque. */
let taken = false;

const EMPTY: HydrationResult = { restored: 0, dropped: 0, recent: [], known: [] };
const hydrations = new Map<string, Promise<HydrationResult>>();
const settled = new Set<string>();

/** Le stockage de la plateforme (appelé au chargement de son module, avant tout préchargement). */
export function configureOctaveCacheBackend(make: () => OctaveCacheBackend): void {
  factory = make;
}

export function octaveCacheBackend(): OctaveCacheBackend {
  return (backend ??= factory());
}

/** Pour les tests : un autre stockage (null : celui de la plateforme), rien de lu. */
export function setOctaveCacheBackend(next: OctaveCacheBackend | null): void {
  backend = next;
  preload = null;
  preloaded = null;
  taken = false;
}

/** Pour les tests. */
export function resetOctaveCacheHydration(next: OctaveCacheBackend | null): void {
  setOctaveCacheBackend(next);
  hydrations.clear();
  settled.clear();
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

/** L'hydratation de cette identité est faite (la porte peut rendre aussitôt). */
export function isOctaveCacheHydrated(owner: string): boolean {
  return settled.has(owner);
}

/** L'hydratation de cette identité, une fois par chargement : synchrone si la lecture du démarrage est finie. */
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
 * Le démarrage en Octave, côté cache : attendre au plus `OCTAVE_BOOT_BUDGET_MS`
 * la lecture du disque ET ce que l'appelant attend d'autre, puis rendre les
 * pages de l'identité dans le cache — avant le premier rendu. Au-delà du
 * budget, l'hydratation reprendra la lecture quand elle finira.
 */
export async function bootOctaveCacheFor(qc: OctaveQueryClientLike, owner: string | null, alongside: Promise<unknown> = Promise.resolve()): Promise<void> {
  if (owner === null) return;
  await withinBudget(Promise.all([preloadOctaveCache(), alongside]));
  void octaveCacheHydration(qc, owner);
}
