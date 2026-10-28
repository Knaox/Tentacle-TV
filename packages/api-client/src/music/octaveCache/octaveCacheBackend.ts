/**
 * Octave — le PORT du stockage des pages gardées : chaque plateforme branche
 * le sien (IndexedDB sur le web et le bureau, SQLite sur le mobile), une
 * entrée par clé de requête. Tout échec rend un stockage VIDE : Octave marche
 * alors comme sans cache. La version en mémoire sert aux tests.
 */

import type { StoredEntry } from "./octaveCachePolicy";

export interface OctaveCacheBackend {
  /** Toutes les entrées (tous comptes : la politique trie). */
  loadAll(): Promise<StoredEntry[]>;
  put(entries: readonly StoredEntry[]): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
}

// Une copie par JSON : `structuredClone` n'existe pas sous Hermes.
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Pour les tests (et un appareil sans stockage : rien n'y survit au redémarrage). */
export function memoryBackend(initial: readonly StoredEntry[] = []): OctaveCacheBackend & { entries: Map<string, StoredEntry> } {
  const entries = new Map(initial.map((e) => [e.id, copy(e)]));
  return {
    entries,
    loadAll: async () => [...entries.values()].map((e) => copy(e)),
    put: async (list) => {
      for (const e of list) entries.set(e.id, copy(e));
    },
    remove: async (ids) => {
      for (const id of ids) entries.delete(id);
    },
  };
}
