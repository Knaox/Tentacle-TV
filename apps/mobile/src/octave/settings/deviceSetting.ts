/**
 * Octave (mobile) — un réglage de l'APPAREIL sur le stockage préchargé (`RNStorageAdapter`) : lu une fois quand
 * le stockage est prêt (`configureOctaveSettings`, à la racine après l'hydratation), puis gardé en mémoire et
 * suivi par `useSyncExternalStore`. Les lectures (défauts compris) sont celles du partagé
 * (`@tentacle-tv/shared/octave` › `octaveDeviceSettings.ts`) : les mêmes que le bureau, jamais une copie.
 *
 * ⚠️ Chaque clé doit être dans `STORAGE_KEYS` (`storage/RNStorageAdapter.ts`) : sinon elle s'écrit mais n'est
 * jamais relue au lancement suivant.
 */

import { useSyncExternalStore } from "react";
import type { StorageAdapter } from "@tentacle-tv/api-client";

type Reader = Pick<StorageAdapter, "getItem">;

export interface DeviceSetting<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
  use(): T;
}

interface Spec<T> {
  key: string;
  /** La valeur gardée → la valeur en vigueur (défaut compris) ; `storage` pour un réglage qui hérite d'un autre. */
  read: (raw: string | null, storage: Reader) => T;
  /** La valeur à écrire ; `null` : retirer la clé (le défaut ne s'écrit pas). */
  write: (value: T) => string | null;
}

let storage: StorageAdapter | null = null;
const reloads: Array<() => void> = [];

export function deviceSetting<T>({ key, read, write }: Spec<T>): DeviceSetting<T> {
  const empty: Reader = { getItem: () => null };
  let value = read(null, empty);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  reloads.push(() => {
    const next = storage ? read(storage.getItem(key), storage) : value;
    if (Object.is(next, value)) return;
    value = next;
    notify();
  });
  const get = () => value;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    get,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      const raw = write(next);
      try {
        if (raw === null) storage?.removeItem(key);
        else storage?.setItem(key, raw);
      } catch {
        /* stockage refusé : le choix vaut jusqu'au prochain lancement */
      }
      notify();
    },
    subscribe,
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}

/** Le stockage est prêt (hydraté) : chaque réglage relit sa clé. */
export function configureOctaveSettings(adapter: StorageAdapter): void {
  storage = adapter;
  for (const reload of reloads) reload();
}
