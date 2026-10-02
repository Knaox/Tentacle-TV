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

/**
 * La demande du compte après une demande de plus sur le même titre : ses
 * saisons s'additionnent, son état reste le sien (ce qui bouge l'emporte,
 * comme dans la liste de l'extension) ; sans demande d'avant, la nouvelle.
 */
export function mergedRequest(existing: MyTitle | undefined, fresh: MyTitle): MyTitle {
  if (!existing) return fresh;
  const seasons = existing.seasons === null || fresh.seasons === null
    ? null
    : [...new Set([...existing.seasons, ...fresh.seasons])].sort((a, b) => a - b);
  return { ...existing, seasons };
}
