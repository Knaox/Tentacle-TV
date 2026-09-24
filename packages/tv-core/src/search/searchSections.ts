import type {
  SearchFacetHit,
  SearchItemHit,
  SearchMediaItem,
  SearchPersonHit,
  SearchResponse,
  SearchTopHit,
} from "@tentacle-tv/shared";

/**
 * Les résultats de recherche d'un téléviseur, en rangées.
 *
 * Au bureau, la recherche est une liste qu'on parcourt à la souris ; devant
 * une télévision, c'est une pile de rangées qu'on descend au D-pad. L'ordre
 * de ces rangées décide du nombre d'appuis : la catégorie du meilleur
 * résultat monte donc juste sous lui — chercher un acteur met « Personnes »
 * en premier, chercher une saga met « Collections » en premier.
 *
 * Rien que du pur : la LG (DOM) et l'Apple TV / Android TV (React Native)
 * dessinent chacune ces rangées, dans le même ordre.
 */

export type TvSearchItemKey = "movies" | "series" | "collections";

export interface TvSearchFacet {
  kind: "genre" | "studio";
  name: string;
  count: number;
}

export type TvSearchSection =
  | { key: "top"; top: SearchTopHit }
  | { key: TvSearchItemKey; hits: SearchItemHit[]; total: number }
  | { key: "people"; people: SearchPersonHit[]; total: number }
  | { key: "episodes"; episodes: SearchMediaItem[] }
  | { key: "facets"; facets: TvSearchFacet[] };

export type TvSearchSectionKey = TvSearchSection["key"];

/** L'ordre de lecture sans meilleur résultat : ce qu'on regarde avant qui le joue. */
const BASE_ORDER: readonly Exclude<TvSearchSectionKey, "top">[] = [
  "movies", "series", "collections", "people", "episodes", "facets",
];

/** La rangée où se range le meilleur résultat — celle qui monte sous lui. */
function topCategory(top: SearchTopHit | null): Exclude<TvSearchSectionKey, "top"> | null {
  if (!top) return null;
  if (top.kind === "person") return "people";
  switch (top.hit.item.Type) {
    case "Movie": return "movies";
    case "Series": return "series";
    case "BoxSet": return "collections";
    default: return null;
  }
}

function facetsOf(genres: readonly SearchFacetHit[], studios: readonly SearchFacetHit[]): TvSearchFacet[] {
  return [
    ...genres.map((g) => ({ kind: "genre" as const, name: g.name, count: g.count })),
    ...studios.map((s) => ({ kind: "studio" as const, name: s.name, count: s.count })),
  ];
}

/**
 * Les rangées à dessiner pour une réponse du moteur (et, à part, les
 * épisodes, que le moteur cherche par Jellyfin). Une rangée vide n'existe
 * pas ; le meilleur résultat, retiré de sa liste par le serveur, ouvre la
 * page.
 */
export function tvSearchSections(
  data: SearchResponse | undefined,
  episodes: readonly SearchMediaItem[] = [],
): TvSearchSection[] {
  if (!data) return episodes.length > 0 ? [{ key: "episodes", episodes: [...episodes] }] : [];

  const byKey = new Map<Exclude<TvSearchSectionKey, "top">, TvSearchSection>();
  if (data.movies.length > 0) byKey.set("movies", { key: "movies", hits: data.movies, total: data.totals.movies });
  if (data.series.length > 0) byKey.set("series", { key: "series", hits: data.series, total: data.totals.series });
  if (data.collections.length > 0) {
    byKey.set("collections", { key: "collections", hits: data.collections, total: data.totals.collections });
  }
  if (data.people.length > 0) byKey.set("people", { key: "people", people: data.people, total: data.totals.people });
  if (episodes.length > 0) byKey.set("episodes", { key: "episodes", episodes: [...episodes] });
  const facets = facetsOf(data.genres, data.studios);
  if (facets.length > 0) byKey.set("facets", { key: "facets", facets });

  const promoted = topCategory(data.top);
  const order = promoted ? [promoted, ...BASE_ORDER.filter((k) => k !== promoted)] : BASE_ORDER;
  const sections: TvSearchSection[] = data.top ? [{ key: "top", top: data.top }] : [];
  for (const key of order) {
    const section = byKey.get(key);
    if (section) sections.push(section);
  }
  return sections;
}

/** Ce que la page dit au-dessus des rangées — une seule phrase à la fois. */
export type TvSearchNotice =
  | { kind: "correction"; correction: string }
  | { kind: "partial" }
  | { kind: "indexing" }
  | null;

export function tvSearchNotice(data: SearchResponse | undefined): TvSearchNotice {
  if (!data) return null;
  if (!data.ready) return { kind: "indexing" };
  if (data.correction) return { kind: "correction", correction: data.correction };
  if (data.partial) return { kind: "partial" };
  return null;
}

/** Une réponse du moteur sans rien à montrer (épisodes compris). */
export function tvSearchIsEmpty(data: SearchResponse | undefined, episodes: readonly SearchMediaItem[] = []): boolean {
  return tvSearchSections(data, episodes).length === 0;
}
