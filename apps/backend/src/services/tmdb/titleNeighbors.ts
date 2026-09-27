/**
 * Voisins COLLABORATIFS d'un titre : sa liste `/recommendations` TMDB (« ceux
 * qui ont aimé ce titre ont aimé… »), récupérée dans le MÊME appel que la
 * fiche (append_to_response) et stockée réduite aux identifiants. C'est elle
 * qui relie Fight Club à American Psycho quand leurs mots-clés ne se
 * ressemblent pas.
 */
export interface TitleNeighbor {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

export interface RawRecommendations {
  results?: Array<{ id: number; media_type?: string }>;
}

/** Voisins retenus par titre — la première page TMDB en compte vingt. */
const NEIGHBORS_MAX = 20;

function typeOf(raw: { media_type?: string }, fallback: "movie" | "tv"): "movie" | "tv" | null {
  if (raw.media_type === "movie" || raw.media_type === "tv") return raw.media_type;
  return raw.media_type ? null : fallback;
}

/** Le bloc brut réduit à ce qu'on garde en cache : ids et type, ordre TMDB. */
export function slimRecommendations(
  raw: RawRecommendations | undefined,
  fallback: "movie" | "tv"
): RawRecommendations {
  const results: Array<{ id: number; media_type: string }> = [];
  for (const r of raw?.results ?? []) {
    const t = typeOf(r, fallback);
    if (t && Number.isFinite(r.id)) results.push({ id: r.id, media_type: t });
    if (results.length >= NEIGHBORS_MAX) break;
  }
  return { results };
}

/** Voisins d'une fiche en cache ; null = ligne d'avant la clé (inconnu). */
export function neighborsOf(
  raw: RawRecommendations | undefined,
  fallback: "movie" | "tv"
): TitleNeighbor[] | null {
  if (!raw) return null;
  const out: TitleNeighbor[] = [];
  for (const r of raw.results ?? []) {
    const t = typeOf(r, fallback);
    if (t && Number.isFinite(r.id)) out.push({ mediaType: t, tmdbId: r.id });
  }
  return out;
}
