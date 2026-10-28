/**
 * Octave — où l'appareil garde les jaquettes des playlists gardées : IndexedDB, une entrée par couverture
 * (`covers`) et par image copiée (`images`, l'image elle-même en Blob), rangées par compte de l'appareil. Tout échec
 * (quota, base bloquée) rend un stockage VIDE : la jaquette retombe sur la règle calculée (`keptPlaylistArt.ts`).
 * Une version en mémoire pour les tests.
 */

import type { KeptCover } from "./coverPlan";

export interface StoredCover extends KeptCover {
  /** `<compte>|<playlist>` */
  id: string;
  owner: string;
}

export interface StoredImage {
  /** `<compte>|<adresse du serveur>` */
  id: string;
  owner: string;
  url: string;
  blob: Blob;
}

export interface CoverBackend {
  load(owner: string): Promise<{ covers: StoredCover[]; images: StoredImage[] }>;
  putCover(cover: StoredCover): Promise<void>;
  putImage(image: StoredImage): Promise<void>;
  remove(store: "covers" | "images", ids: readonly string[]): Promise<void>;
}

/** Noms traversés par l'appareil de l'utilisateur : ne jamais les renommer (ses jaquettes y vivent). */
const DB_NAME = "tentacle_octave_kept_covers";
const VERSION = 1;

export const coverId = (owner: string, playlistId: string) => `${owner}|${playlistId}`;
export const imageId = (owner: string, url: string) => `${owner}|${url}`;

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
      for (const name of ["covers", "images"]) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: "id" }).createIndex("owner", "owner");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("kept covers blocked"));
  });
}

export function indexedDbCoverBackend(factory: IDBFactory | undefined = globalThis.indexedDB): CoverBackend {
  let db: Promise<IDBDatabase | null> | null = null;
  const database = () => (db ??= factory ? open(factory).catch(() => null) : Promise.resolve(null));
  const write = async (store: "covers" | "images", run: (s: IDBObjectStore) => void) => {
    const d = await database();
    if (!d) return;
    try {
      const tx = d.transaction(store, "readwrite");
      run(tx.objectStore(store));
      await done(tx);
    } catch {
      /* Quota, base fermée : la jaquette retombe sur la règle calculée. */
    }
  };
  return {
    async load(owner) {
      const d = await database();
      if (!d) return { covers: [], images: [] };
      try {
        const tx = d.transaction(["covers", "images"], "readonly");
        const [covers, images] = await Promise.all([
          request(tx.objectStore("covers").index("owner").getAll(owner)),
          request(tx.objectStore("images").index("owner").getAll(owner)),
        ]);
        return { covers: covers as StoredCover[], images: images as StoredImage[] };
      } catch {
        return { covers: [], images: [] };
      }
    },
    putCover: (cover) => write("covers", (s) => void s.put(cover)),
    putImage: (image) => write("images", (s) => void s.put(image)),
    remove: (store, ids) => (ids.length === 0 ? Promise.resolve() : write(store, (s) => ids.forEach((id) => s.delete(id)))),
  };
}

export function memoryCoverBackend(): CoverBackend & { covers: Map<string, StoredCover>; images: Map<string, StoredImage> } {
  const covers = new Map<string, StoredCover>();
  const images = new Map<string, StoredImage>();
  return {
    covers,
    images,
    load: async (owner) => ({ covers: [...covers.values()].filter((c) => c.owner === owner), images: [...images.values()].filter((i) => i.owner === owner) }),
    putCover: async (c) => void covers.set(c.id, c),
    putImage: async (i) => void images.set(i.id, i),
    remove: async (store, ids) => ids.forEach((id) => (store === "covers" ? covers : images).delete(id)),
  };
}
