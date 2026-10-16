import { useCallback, useSyncExternalStore } from "react";

/**
 * Un réglage d'APPAREIL à CHOIX (un délai parmi quelques-uns), gardé dans
 * `localStorage` comme `deviceFlag.ts` : seul l'écart au défaut est écrit, une
 * valeur illisible ou hors des choix vaut le défaut (`parse`), un stockage
 * refusé laisse le réglage valoir pour la session en cours.
 */
export interface DeviceChoice<T extends number> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

export function createDeviceChoice<T extends number>(storageKey: string, defaultValue: T, parse: (raw: unknown) => T): DeviceChoice<T> {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? defaultValue : parse(raw);
    } catch {
      return defaultValue;
    }
  };
  let value = read();
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(raw) {
      const next = parse(raw);
      if (next === value) return;
      value = next;
      try {
        if (next === defaultValue) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, String(next));
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
export function useDeviceChoice<T extends number>(choice: DeviceChoice<T>): [T, (next: T) => void] {
  const value = useSyncExternalStore(choice.subscribe, choice.get, choice.get);
  const set = useCallback((next: T) => choice.set(next), [choice]);
  return [value, set];
}
