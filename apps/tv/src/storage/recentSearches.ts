import { tvStorage } from "./RNStorageAdapter";

/**
 * Recherches récentes — port téléviseur de
 * `apps/web/src/components/search/recentSearches.ts` (mêmes règles, même clé),
 * sur `tvStorage` : `localStorage` n'existe pas en React Native, et l'adaptateur
 * est synchrone une fois hydraté — la liste s'affiche instantanément.
 *
 * Une requête tapée ne quitte jamais l'appareil.
 */

const KEY = "tentacle_recent_searches";
/** Au-delà, la liste devient un historique qu'on parcourt au lieu d'un raccourci. */
const MAX = 6;
/** Trop court pour désigner quoi que ce soit : on ne mémorise pas. */
const MIN_LENGTH = 2;

export function readRecentSearches(): string[] {
  try {
    const raw = tvStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Ajoute une requête en tête. La casse et les espaces de bord sont normalisés
 * pour la COMPARAISON seulement : « Le Bear » et « le bear  » ne doivent pas
 * occuper deux entrées, mais on réaffiche ce que l'utilisateur a réellement
 * tapé.
 */
export function pushRecentSearch(query: string): string[] {
  const value = query.trim();
  if (value.length < MIN_LENGTH) return readRecentSearches();
  const key = value.toLocaleLowerCase();
  const next = [value, ...readRecentSearches().filter((v) => v.toLocaleLowerCase() !== key)].slice(0, MAX);
  try {
    tvStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Stockage refusé : la recherche marche quand même. */
  }
  return next;
}

export function clearRecentSearches(): string[] {
  try {
    tvStorage.removeItem(KEY);
  } catch {
    /* idem */
  }
  return [];
}
