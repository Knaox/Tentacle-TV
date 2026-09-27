/**
 * Noms des genres TMDB (films et séries), en dur : la liste est figée depuis
 * des années, et la lire à l'API coûterait un appel par langue pour quelques
 * mots. Un id inconnu ne s'affiche pas — il n'invente rien.
 */
const GENRES: Record<number, { fr: string; en: string }> = {
  28: { fr: "Action", en: "Action" },
  12: { fr: "Aventure", en: "Adventure" },
  16: { fr: "Animation", en: "Animation" },
  35: { fr: "Comédie", en: "Comedy" },
  80: { fr: "Crime", en: "Crime" },
  99: { fr: "Documentaire", en: "Documentary" },
  18: { fr: "Drame", en: "Drama" },
  10751: { fr: "Familial", en: "Family" },
  14: { fr: "Fantastique", en: "Fantasy" },
  36: { fr: "Histoire", en: "History" },
  27: { fr: "Horreur", en: "Horror" },
  10402: { fr: "Musique", en: "Music" },
  9648: { fr: "Mystère", en: "Mystery" },
  10749: { fr: "Romance", en: "Romance" },
  878: { fr: "Science-fiction", en: "Science Fiction" },
  10770: { fr: "Téléfilm", en: "TV Movie" },
  53: { fr: "Thriller", en: "Thriller" },
  10752: { fr: "Guerre", en: "War" },
  37: { fr: "Western", en: "Western" },
  10759: { fr: "Action & aventure", en: "Action & Adventure" },
  10762: { fr: "Enfants", en: "Kids" },
  10763: { fr: "Actualités", en: "News" },
  10764: { fr: "Téléréalité", en: "Reality" },
  10765: { fr: "Science-fiction & fantastique", en: "Sci-Fi & Fantasy" },
  10766: { fr: "Feuilleton", en: "Soap" },
  10767: { fr: "Talk-show", en: "Talk" },
  10768: { fr: "Guerre & politique", en: "War & Politics" },
};

export type SwipeLang = "fr" | "en";

export function tmdbGenreName(id: number, lang: SwipeLang): string | null {
  return GENRES[id]?.[lang] ?? null;
}

/** Les noms des genres portés par des facettes `genre:<id>` (ordre gardé). */
export function genreNamesFromFacets(keys: readonly string[], lang: SwipeLang, max = 3): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const m = /^genre:(\d+)$/.exec(key);
    const name = m ? tmdbGenreName(Number(m[1]), lang) : null;
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= max) break;
  }
  return out;
}
