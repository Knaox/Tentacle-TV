/**
 * Octave — le stockage de l'APPAREIL vu par les règles des pages (recherches
 * récentes, écoutes, pages consultées) : synchrone, comme `localStorage` sur le
 * web et l'adaptateur préchargé du mobile (`RNStorageAdapter`). Une écriture
 * refusée ou un stockage plein ne cassent jamais la page.
 */

export interface OctaveDeviceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Lit une valeur JSON ; illisible ou absente → `null`. */
export function readJson(store: OctaveDeviceStore | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJson(store: OctaveDeviceStore | null, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* Stockage refusé ou plein : la page marche quand même. */
  }
}

export function removeKey(store: OctaveDeviceStore | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    /* rien à oublier */
  }
}
