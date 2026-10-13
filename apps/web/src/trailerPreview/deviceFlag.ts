import { useCallback, useSyncExternalStore } from "react";

/**
 * Un réglage d'APPAREIL à deux états, gardé dans `localStorage` — comme le mode
 * d'apparence ou l'économie de données : il dépend de l'endroit où tourne
 * l'app, pas du compte. Seul l'écart au défaut est écrit (`"1"` / `"0"`) ;
 * revenir au défaut efface la clé.
 *
 * Lecture et écriture protégées : un stockage refusé (navigation privée,
 * quota, aperçu) laisse le réglage valoir pour la session en cours, sans
 * erreur.
 */
export interface DeviceFlag {
  get(): boolean;
  set(next: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createDeviceFlag(storageKey: string, defaultValue: boolean): DeviceFlag {
  const read = (): boolean => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === "1" ? true : raw === "0" ? false : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  let value = read();
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      try {
        if (next === defaultValue) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* Persistance impossible : le réglage vaut pour la session en cours. */
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Le réglage en direct, et son écriture (identité stable). */
export function useDeviceFlag(flag: DeviceFlag): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(flag.subscribe, flag.get, flag.get);
  const set = useCallback((next: boolean) => flag.set(next), [flag]);
  return [value, set];
}
