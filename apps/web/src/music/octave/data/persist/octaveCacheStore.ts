/**
 * Octave — le stockage des pages gardées : IndexedDB, une entrée par clé de
 * requête (écritures incrémentales, jamais un gros bloc réécrit), et une
 * version en mémoire pour les tests. Tout échec (navigation privée, quota,
 * base bloquée) rend un stockage VIDE : Octave marche alors comme avant.
 */

import type { OctaveCacheBackend, StoredEntry } from "@tentacle-tv/api-client";

// Le port et la version en mémoire sont communs au mobile (`@tentacle-tv/api-client`, `octaveCache/`).
export { memoryBackend, type OctaveCacheBackend } from "@tentacle-tv/api-client";

/** Noms traversés par le navigateur de l'utilisateur : ne jamais les renommer (son cache y vit). */
const DB_NAME = "tentacle_octave_cache";
const STORE = "pages";
const VERSION = 1;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // Une autre fenêtre tient une version plus ancienne : on renonce plutôt que d'attendre.
    req.onblocked = () => reject(new Error("octave cache blocked"));
  });
}

export function indexedDbBackend(factory: IDBFactory | undefined = globalThis.indexedDB): OctaveCacheBackend {
  let db: Promise<IDBDatabase | null> | null = null;
  const database = () => (db ??= factory ? open(factory).catch(() => null) : Promise.resolve(null));
  return {
    async loadAll() {
      const d = await database();
      if (!d) return [];
      try {
        return (await request(d.transaction(STORE, "readonly").objectStore(STORE).getAll())) as StoredEntry[];
      } catch {
        return [];
      }
    },
    async put(entries) {
      const d = await database();
      if (!d || entries.length === 0) return;
      try {
        const tx = d.transaction(STORE, "readwrite");
        for (const e of entries) tx.objectStore(STORE).put(e);
        await done(tx);
      } catch {
        /* Quota, clone impossible : la page n'est simplement pas gardée. */
      }
    },
    async remove(ids) {
      const d = await database();
      if (!d || ids.length === 0) return;
      try {
        const tx = d.transaction(STORE, "readwrite");
        for (const id of ids) tx.objectStore(STORE).delete(id);
        await done(tx);
      } catch {
        /* Rien à faire : l'éviction recommencera au prochain montage. */
      }
    },
  };
}
