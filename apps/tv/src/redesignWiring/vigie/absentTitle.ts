import { parseTitleKey, titleKey, type MyTitle, type TitleKey } from "@tentacle-tv/shared";

/**
 * Un titre ABSENT de la bibliothèque, tel que la collection et la recherche le
 * passent au geste « demander » (`useTitleRequests`) : sa clé TMDB, ses mots,
 * son affiche.
 */
export interface AbsentTitle {
  key: TitleKey;
  title: string;
  year: number | null;
  /** L'affiche TMDB (adresse complète), s'il y en a une. */
  imageUrl: string | null;
}

export function absentTitle(kind: "movie" | "series", tmdbId: number, title: string, year: number | null, imageUrl: string | null): AbsentTitle {
  return { key: titleKey(kind === "movie" ? "movie" : "tv", tmdbId), title, year, imageUrl };
}

/** Le titre qu'on vient de demander, tel que la liste des demandes du compte le montre aussitôt. */
export function requestedTitle(title: AbsentTitle, seasons: number[] | null = null): MyTitle | null {
  const parsed = parseTitleKey(title.key);
  if (!parsed) return null;
  return {
    key: title.key,
    mediaType: parsed.mediaType,
    tmdbId: parsed.tmdbId,
    title: title.title,
    year: title.year,
    imageUrl: title.imageUrl,
    seasons: parsed.mediaType === "tv" ? seasons : null,
    state: "pending",
    percent: null,
    etaSeconds: null,
  };
}
