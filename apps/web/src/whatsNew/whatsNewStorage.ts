/** Clé traversée par une chaîne : ne jamais la renommer. */
export const WHATS_NEW_SEEN_KEY = "tentacle_whats_new_seen";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const VERSION_SHAPE = /^\d+\.\d+/;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * La dernière version dont l'écran de nouveautés a été vu SUR CET APPAREIL —
 * ou `null` : jamais vu, ou valeur illisible (traitée comme une première
 * installation : on note, on ne montre rien). Modèle : `lib/coldStartAck.ts`.
 */
export function readSeenVersion(storage: StorageLike | null = defaultStorage()): string | null {
  try {
    const raw = storage?.getItem(WHATS_NEW_SEEN_KEY)?.trim();
    return raw && VERSION_SHAPE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeSeenVersion(version: string, storage: StorageLike | null = defaultStorage()): void {
  if (!VERSION_SHAPE.test(version)) return;
  try {
    storage?.setItem(WHATS_NEW_SEEN_KEY, version);
  } catch {
    // Stockage refusé (navigation privée…) : l'écran se remontrera, sans casse.
  }
}
