import { tmdbGenreName } from "../swipe/tmdbGenres";

/**
 * Le pont des noms de genres Jellyfin vers les ids TMDB, pour les titres sans
 * fiche TMDB en cache. Jellyfin écrit les genres dans la langue de ses
 * métadonnées (« Science-Fiction », « Comédie », « Sci-Fi & Fantasy »…) : on
 * les rapproche des noms français et anglais de TMDB, plus quelques variantes
 * courantes. Un nom inconnu (les étiquettes d'AniDB : « super power », « Earth »)
 * n'est PAS un genre : il ne compte nulle part, plutôt que de brouiller le
 * classement.
 */

/** Les ids de genres TMDB, films et séries (cf. `swipe/tmdbGenres.ts`). */
const TMDB_GENRE_IDS = [
  28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37,
  10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768,
];

const ALIASES: Record<string, number> = {
  "sci fi": 878,
  "science fiction": 878,
  "sf": 878,
  "sci fi and fantasy": 10765,
  "science fiction and fantasy": 10765,
  "action and adventure": 10759,
  "war and politics": 10768,
  "tv movie": 10770,
  "telefilm": 10770,
  "kids": 10762,
  "children": 10762,
  "family": 10751,
  "policier": 80,
  "fantasy": 14,
  "musical": 10402,
  "suspense": 53,
  "documentary": 99,
};

/** Minuscules, sans accents, « & » → « and », ponctuation → espaces. */
export function normalizeGenreName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bet\b/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_NAME: Map<string, number> = (() => {
  const map = new Map<string, number>();
  for (const id of TMDB_GENRE_IDS) {
    for (const lang of ["fr", "en"] as const) {
      const name = tmdbGenreName(id, lang);
      if (name) map.set(normalizeGenreName(name), id);
    }
  }
  for (const [alias, id] of Object.entries(ALIASES)) map.set(normalizeGenreName(alias), id);
  return map;
})();

/** Les ids TMDB des genres Jellyfin reconnus, sans doublon, dans l'ordre. */
export function genreIdsFromNames(names: readonly string[]): number[] {
  const out: number[] = [];
  for (const name of names) {
    const id = BY_NAME.get(normalizeGenreName(name));
    if (id !== undefined && !out.includes(id)) out.push(id);
  }
  return out;
}
