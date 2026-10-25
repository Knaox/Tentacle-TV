/**
 * Les abonnés au `LibraryChanged` de Jellyfin (relayé par les sockets des
 * comptes, `jellyfinUserEvents.ts`) : un module qui veut savoir QUELS éléments
 * ont changé — le runtime des extensions pousse `jellyfin.audioItems` à ses
 * invités — s'y inscrit, sans toucher à la relève des rangées.
 *
 * Appelés AVANT la déduplication des rangées (2 s, une par salve) : deux salves
 * rapprochées portent des éléments différents, et aucune ne doit se perdre.
 * Les copies d'une MÊME salve (un appareil connecté = une copie) sont, elles,
 * écartées ici, par leur contenu.
 */

export interface LibraryChange {
  added: string[];
  updated: string[];
  removed: string[];
}

type Listener = (change: LibraryChange) => void;

const listeners = new Set<Listener>();
const DUPLICATE_MS = 2_000;
let last: { signature: string; at: number } | null = null;

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v)) : [];
}

export function onLibraryChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `data` : la charge de `LibraryChanged` (`ItemsAdded`, `ItemsUpdated`, `ItemsRemoved`). */
export function notifyLibraryListeners(data: unknown, now = Date.now()): void {
  if (listeners.size === 0 || !data || typeof data !== "object") return;
  const raw = data as Record<string, unknown>;
  const change: LibraryChange = { added: ids(raw.ItemsAdded), updated: ids(raw.ItemsUpdated), removed: ids(raw.ItemsRemoved) };
  if (change.added.length + change.updated.length + change.removed.length === 0) return;
  const signature = JSON.stringify(change);
  if (last && last.signature === signature && now - last.at < DUPLICATE_MS) return;
  last = { signature, at: now };
  for (const listener of listeners) {
    try {
      listener(change);
    } catch (err) {
      console.warn("[JellyfinEvents] abonné en échec :", err instanceof Error ? err.message : err);
    }
  }
}
