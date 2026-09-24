import { useCallback, useState } from "react";
import { useTentacleConfig, type StorageAdapter } from "@tentacle-tv/api-client";

/**
 * Recherches récentes, gardées sur l'appareil — la règle du web
 * (`recentSearches.ts`), même clé : on recherche très souvent deux fois la
 * même chose, et retaper une requête qu'on vient de faire est le geste le plus
 * évitable de l'écran. Une requête tapée ne quitte pas le téléphone.
 */

const KEY = "tentacle_recent_searches";
/** Au-delà, la liste devient un historique qu'on parcourt au lieu d'un raccourci. */
const MAX = 6;
/** Trop court pour désigner quoi que ce soit : on ne mémorise pas. */
const MIN_LENGTH = 2;

function read(storage: StorageAdapter): string[] {
  try {
    const raw = storage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(storage: StorageAdapter, list: string[]): string[] {
  if (list.length === 0) storage.removeItem(KEY);
  else storage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function useRecentSearches() {
  const { storage } = useTentacleConfig();
  const [recent, setRecent] = useState<string[]>(() => read(storage));

  /** En tête ; la casse et les espaces ne comptent que pour la COMPARAISON. */
  const push = useCallback((query: string) => {
    const value = query.trim();
    if (value.length < MIN_LENGTH) return;
    const key = value.toLocaleLowerCase();
    setRecent(write(storage, [value, ...read(storage).filter((v) => v.toLocaleLowerCase() !== key)].slice(0, MAX)));
  }, [storage]);

  const remove = useCallback((query: string) => {
    const key = query.trim().toLocaleLowerCase();
    setRecent(write(storage, read(storage).filter((v) => v.toLocaleLowerCase() !== key)));
  }, [storage]);

  const clear = useCallback(() => setRecent(write(storage, [])), [storage]);

  return { recent, push, remove, clear };
}
