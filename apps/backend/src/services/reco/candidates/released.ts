/**
 * « Au minimum au cinéma » : un titre n'est recommandable que SORTI — un film
 * en salles, une série déjà diffusée. La date TMDB ou Vigie (release_date,
 * first_air_date) doit être connue et ne pas être dans le futur ; sans date,
 * on ne sait pas, et un titre annoncé sans date n'a rien à faire dans une
 * recommandation. Comparaison sur le jour UTC : le jour de sortie compte.
 */
export interface DatedResult {
  release_date?: string;
  first_air_date?: string;
  releaseDate?: string;
  firstAirDate?: string;
}

export function releaseDateOf(raw: DatedResult): string | undefined {
  return raw.release_date || raw.first_air_date || raw.releaseDate || raw.firstAirDate || undefined;
}

export function todayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isReleasedOn(date: string | null | undefined, now: Date = new Date()): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return false;
  return date.slice(0, 10) <= todayStamp(now);
}

export function isReleasedResult(raw: DatedResult, now: Date = new Date()): boolean {
  return isReleasedOn(releaseDateOf(raw), now);
}

/**
 * Le plafond de date d'une requête /discover : aujourd'hui, ou la borne déjà
 * posée si elle est plus tôt (les décennies passées). TMDB filtre alors à la
 * source — le filtre local reste pour les listes sans paramètre
 * (recommandations, similaires, crédits, tendances) et pour les dates que
 * /discover laisse passer.
 */
export function cappedReleaseParams(
  mediaType: "movie" | "tv",
  query: Record<string, string>,
  now: Date = new Date()
): Record<string, string> {
  const field = mediaType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
  const today = todayStamp(now);
  const current = query[field];
  return { ...query, [field]: current && current < today ? current : today };
}
