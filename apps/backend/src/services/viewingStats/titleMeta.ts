import { getPrisma } from "../db";
import { isAnimeTmdb } from "../reco/facets";
import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import type { ViewingStatsPerson } from "./contract";
import type { TitleInfo } from "./dataset";

/**
 * Les fiches TMDB DÉJÀ en cache (`tmdb_meta_cache`) complètent les titres :
 * genres propres, langue originale, réalisation et premiers rôles. Jamais un
 * appel TMDB d'ici — les statistiques lisent ce que le moteur a déjà payé.
 *
 * Une fiche pèse ~60 Ko de JSON : on ne lit que celles des titres qui pèsent
 * le plus dans le temps de visionnage. Au-delà, les genres Jellyfin suffisent.
 */
export const META_TITLES_MAX = 250;
const DIRECTORS_PER_TITLE = 3;
const CAST_PER_TITLE = 5;

const mediaTypeOf = (t: TitleInfo): "movie" | "tv" => (t.kind === "movie" ? "movie" : "tv");

/** Complète `titles` en place ; `ranking` = ids Jellyfin, le plus regardé d'abord. */
export async function enrichWithTmdb(titles: Map<string, TitleInfo>, ranking: readonly string[]): Promise<void> {
  const refs: Array<{ mediaType: "movie" | "tv"; tmdbId: number }> = [];
  for (const id of ranking) {
    const t = titles.get(id);
    if (t?.tmdbId) refs.push({ mediaType: mediaTypeOf(t), tmdbId: t.tmdbId });
    if (refs.length >= META_TITLES_MAX) break;
  }
  if (refs.length === 0) return;
  const metas = await getCachedMetaMany(refs);
  for (const t of titles.values()) {
    if (!t.tmdbId) continue;
    const meta = metas.get(metaKey(mediaTypeOf(t), t.tmdbId));
    if (!meta) continue;
    if (meta.genres.length > 0) t.genreIds = meta.genres.map((g) => g.id);
    t.language = meta.originalLanguage;
    t.year = t.year ?? meta.year;
    t.anime = t.anime || isAnimeTmdb(meta);
    t.directors = meta.directors.slice(0, DIRECTORS_PER_TITLE);
    t.cast = meta.topCast.slice(0, CAST_PER_TITLE);
  }
}

interface RawPerson {
  id?: number;
  profile_path?: string | null;
}

interface RawCredits {
  credits?: { cast?: RawPerson[]; crew?: RawPerson[] };
  created_by?: RawPerson[];
}

/**
 * Les portraits des personnes AFFICHÉES : relus dans la fiche brute d'un titre
 * où chacune figure (la forme normalisée du moteur ne garde que les noms).
 * Une quinzaine de fiches au plus, une seule requête.
 */
export async function attachPortraits(
  people: ViewingStatsPerson[],
  titles: Map<string, TitleInfo>
): Promise<void> {
  if (people.length === 0) return;
  const wanted = new Set(people.map((p) => p.tmdbId));
  const refs = new Map<string, { mediaType: "movie" | "tv"; tmdbId: number }>();
  const covered = new Set<number>();
  for (const t of titles.values()) {
    if (!t.tmdbId) continue;
    const ids = [...t.cast, ...t.directors].map((p) => p.id).filter((id) => wanted.has(id) && !covered.has(id));
    if (ids.length === 0) continue;
    ids.forEach((id) => covered.add(id));
    refs.set(metaKey(mediaTypeOf(t), t.tmdbId), { mediaType: mediaTypeOf(t), tmdbId: t.tmdbId });
    if (covered.size >= wanted.size) break;
  }
  if (refs.size === 0) return;

  const rows = await getPrisma().tmdbMetaCache.findMany({
    where: { OR: [...refs.values()] },
    select: { payload: true },
  });
  const portraits = new Map<number, string>();
  for (const row of rows) {
    let raw: RawCredits;
    try {
      raw = JSON.parse(row.payload) as RawCredits;
    } catch {
      continue;
    }
    for (const p of [...(raw.credits?.cast ?? []), ...(raw.credits?.crew ?? []), ...(raw.created_by ?? [])]) {
      if (p.id && p.profile_path && wanted.has(p.id) && !portraits.has(p.id)) portraits.set(p.id, p.profile_path);
    }
  }
  for (const p of people) p.profilePath = portraits.get(p.tmdbId) ?? null;
}
