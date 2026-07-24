/**
 * Recherches récentes, conservées localement.
 *
 * C'est de loin ce qui sert le plus dans un écran de recherche vide : on
 * recherche très souvent deux fois la même chose, à quelques minutes ou quelques
 * jours d'intervalle, et retaper une requête qu'on vient de faire est le geste
 * le plus évitable de toute l'interface.
 *
 * `localStorage` et non le serveur : une requête tapée n'a pas à quitter
 * l'appareil, et cette liste doit s'afficher instantanément — y compris hors
 * ligne, où la recherche elle-même ne fonctionne pas mais où les téléchargements
 * restent accessibles.
 */

const KEY = "tentacle_recent_searches";
/** Au-delà, la liste devient un historique qu'on parcourt au lieu d'un raccourci. */
const MAX = 6;
/** Trop court pour désigner quoi que ce soit : on ne mémorise pas. */
const MIN_LENGTH = 2;

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Ajoute une requête en tête. La casse et les espaces de bord sont normalisés
 * pour la COMPARAISON seulement : « Le Bear » et « le bear  » ne doivent pas
 * occuper deux entrées, mais on réaffiche ce que l'utilisateur a réellement tapé.
 */
export function pushRecentSearch(query: string): string[] {
  const value = query.trim();
  if (value.length < MIN_LENGTH) return readRecentSearches();
  const key = value.toLocaleLowerCase();
  const next = [value, ...readRecentSearches().filter((v) => v.toLocaleLowerCase() !== key)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Quota plein ou stockage refusé : la recherche marche quand même. */
  }
  return next;
}

export function clearRecentSearches(): string[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* idem */
  }
  return [];
}
