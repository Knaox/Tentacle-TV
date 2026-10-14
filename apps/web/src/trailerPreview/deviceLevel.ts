import { useCallback, useSyncExternalStore } from "react";

/**
 * Un réglage d'APPAREIL entre 0 et 1 (un volume), gardé dans `localStorage`
 * comme `deviceFlag.ts` : seul l'écart au défaut est écrit, une valeur
 * illisible vaut le défaut, un stockage refusé laisse le réglage valoir pour
 * la session en cours.
 */
export interface DeviceLevel {
  get(): number;
  set(next: number): void;
  subscribe(listener: () => void): () => void;
}

const clampLevel = (value: number) => Math.min(1, Math.max(0, Math.round(value * 100) / 100));

export function createDeviceLevel(storageKey: string, defaultValue: number): DeviceLevel {
  const read = (): number => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw === null ? Number.NaN : Number(raw);
      return Number.isFinite(parsed) ? clampLevel(parsed) : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  let value = read();
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(raw) {
      const next = clampLevel(raw);
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
export function useDeviceLevel(level: DeviceLevel): [number, (next: number) => void] {
  const value = useSyncExternalStore(level.subscribe, level.get, level.get);
  const set = useCallback((next: number) => level.set(next), [level]);
  return [value, set];
}
