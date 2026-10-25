/**
 * Octave — les éléments DÉJÀ annoncés comme arrivés (`music:library` added,
 * `jellyfin.audioItems` added), pour ne pas les redire.
 *
 * Après un `refreshPath`, le cœur indexe le dossier tout de suite
 * (`folderArrivals.ts`) ; le `LibraryChanged` de Jellyfin arrive ensuite
 * (`LibraryUpdateDuration` : 30 s par défaut) avec les mêmes éléments. Ils sont
 * alors déjà dans l'index : sans ce registre, ils repartiraient en « mis à
 * jour ». Pendant deux minutes, un élément annoncé se met à jour dans l'index
 * EN SILENCE ; au-delà, une vraie mise à jour se dit comme avant.
 */

const WINDOW_MS = 2 * 60_000;
const MAX_ENTRIES = 5_000;

const announced = new Map<string, number>();

export function markAnnounced(ids: readonly string[], now = Date.now()): void {
  for (const id of ids) announced.set(id, now);
  if (announced.size <= MAX_ENTRIES) return;
  for (const [id, at] of announced) if (now - at > WINDOW_MS) announced.delete(id);
  if (announced.size > MAX_ENTRIES) announced.clear();
}

export function wasAnnounced(id: string, now = Date.now()): boolean {
  const at = announced.get(id);
  if (at === undefined) return false;
  if (now - at <= WINDOW_MS) return true;
  announced.delete(id);
  return false;
}

export function resetRecentArrivalsForTests(): void {
  announced.clear();
}
