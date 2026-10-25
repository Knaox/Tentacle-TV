/**
 * Octave — les recherches musique RÉCENTES, gardées sur l'appareil : la
 * première suggestion d'une barre vide, et celles qui commencent comme la
 * frappe. À part de l'historique des films et séries (`tentacle_recent_searches`) :
 * on ne cherche pas « dune » dans la musique.
 */

/** Clé de stockage : ne jamais la renommer (l'historique de l'utilisateur y vit). */
const KEY = "tentacle_octave_recent_searches";
const MAX = 8;
const MIN_LENGTH = 2;

export function readRecentMusicSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): string[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Stockage refusé ou plein : la recherche marche quand même. */
  }
  return list;
}

/** La requête validée passe en tête (casse et espaces comparés, la forme tapée gardée). */
export function pushRecentMusicSearch(query: string): string[] {
  const value = query.trim().replace(/\s+/g, " ");
  if (value.length < MIN_LENGTH) return readRecentMusicSearches();
  const key = value.toLocaleLowerCase();
  return write([value, ...readRecentMusicSearches().filter((v) => v.toLocaleLowerCase() !== key)].slice(0, MAX));
}

export function removeRecentMusicSearch(query: string): string[] {
  const key = query.trim().toLocaleLowerCase();
  return write(readRecentMusicSearches().filter((v) => v.toLocaleLowerCase() !== key));
}
