/**
 * Le Jellyfin FACTICE du labo des fiches : il répond aux chemins que les vrais crochets
 * d'`api-client` demandent, depuis la bibliothèque de démonstration (`labItems.ts`). Les
 * filtres, le tri et la pagination d'une bibliothèque y sont réellement appliqués — c'est ce
 * qui permet de capturer une grille filtrée, vide ou triée sans serveur.
 *
 * `setLabState` simule l'attente (rien ne répond) et la panne (tout échoue) des LISTES et des
 * fiches ; la liste des bibliothèques répond toujours, pour que la page ait son nom.
 */

import type { MediaItem } from "@tentacle-tv/shared";
import { LAB_COLLECTION_ID, LAB_COLLECTION_TITLES, LAB_LIBRARIES, LAB_SERIES_ID } from "./labData";
import { LAB_EPISODE_ITEMS, LAB_ITEMS, LAB_SEASONS, labGenres, labItem, labPerson } from "./labItems";

export type LabState = "ready" | "loading" | "error";
let state: LabState = "ready";
export function setLabState(next: LabState): void {
  state = next;
}

const list = (items: MediaItem[], total = items.length) => ({ Items: items, TotalRecordCount: total });
const ids = (value: string | null): string[] => (value ? value.split(",").filter(Boolean) : []);
const langOf = (item: MediaItem, type: string): string[] =>
  (item.MediaStreams ?? []).filter((s) => (s as { Type?: string }).Type === type).map((s) => (s as { Language?: string }).Language ?? "");

const SORTS: Record<string, (a: MediaItem, b: MediaItem) => number> = {
  SortName: (a, b) => a.Name.localeCompare(b.Name, "fr"),
  DateCreated: (a, b) => (a.DateCreated ?? "").localeCompare(b.DateCreated ?? ""),
  ProductionYear: (a, b) => (a.ProductionYear ?? 0) - (b.ProductionYear ?? 0),
  PremiereDate: (a, b) => (a.ProductionYear ?? 0) - (b.ProductionYear ?? 0),
  CommunityRating: (a, b) => (a.CommunityRating ?? 0) - (b.CommunityRating ?? 0),
};

/** `/Users/{id}/Items` : la bibliothèque, filtrée, triée, paginée comme Jellyfin le ferait. */
function queryItems(q: URLSearchParams): { Items: MediaItem[]; TotalRecordCount: number } {
  const get = (name: string): string | null => q.get(name) ?? q.get(name[0]!.toLowerCase() + name.slice(1));
  const wanted = ids(get("Ids"));
  if (wanted.length > 0) return list(wanted.map(labItem).filter((item): item is MediaItem => !!item));

  const parent = get("ParentId");
  const types = ids(get("IncludeItemTypes"));
  const filters = ids(get("Filters"));
  let pool: MediaItem[] = parent === LAB_COLLECTION_ID
    ? LAB_ITEMS.filter((item) => LAB_COLLECTION_TITLES.includes(item.Id))
    : LAB_ITEMS.filter((item) => !parent || item.ParentId === parent);
  // « En cours » d'une bibliothèque de séries montre des épisodes.
  if (types.includes("Episode")) pool = [...pool.filter((item) => item.Type !== "Series"), ...(!parent || parent === "series" ? LAB_EPISODE_ITEMS : [])];
  if (types.length > 0) pool = pool.filter((item) => types.includes(item.Type));

  const person = get("PersonIds");
  if (person) pool = pool.filter((item) => item.People?.some((p) => p.Id === person));
  const genres = ids(get("GenreIds"));
  if (genres.length > 0) pool = pool.filter((item) => (item as { GenreItems?: Array<{ Id: string }> }).GenreItems?.some((g) => genres.includes(g.Id)));
  const genreNames = ids(get("Genres"));
  if (genreNames.length > 0) pool = pool.filter((item) => item.Genres?.some((g) => genreNames.includes(g)));
  const studios = ids(get("StudioIds"));
  if (studios.length > 0) pool = pool.filter((item) => item.Studios?.some((s) => studios.includes(s.Id)));
  const years = ids(get("Years"));
  if (years.length > 0) pool = pool.filter((item) => years.includes(String(item.ProductionYear)));
  const rating = Number(get("MinCommunityRating") ?? 0);
  if (rating > 0) pool = pool.filter((item) => (item.CommunityRating ?? 0) >= rating);
  if (get("IsFavorite") === "true" || filters.includes("IsFavorite")) pool = pool.filter((item) => item.UserData?.IsFavorite);
  if (filters.includes("Likes")) pool = pool.filter((item) => (item.UserData as { Likes?: boolean } | undefined)?.Likes);
  if (filters.includes("IsUnplayed")) pool = pool.filter((item) => !item.UserData?.Played);
  if (filters.includes("IsPlayed")) pool = pool.filter((item) => item.UserData?.Played);
  if (filters.includes("IsResumable")) pool = pool.filter((item) => (item.UserData?.PlaybackPositionTicks ?? 0) > 0);
  const audio = ids(get("AudioLanguages"));
  if (audio.length > 0) pool = pool.filter((item) => langOf(item, "Audio").some((l) => audio.includes(l)));
  const subs = ids(get("SubtitleLanguages"));
  if (subs.length > 0) pool = pool.filter((item) => langOf(item, "Subtitle").some((l) => subs.includes(l)));
  const term = (get("SearchTerm") ?? "").trim().toLowerCase();
  if (term) pool = pool.filter((item) => item.Name.toLowerCase().includes(term));
  if (ids(get("ImageTypes")).includes("Backdrop")) pool = pool.filter((item) => (item.BackdropImageTags?.length ?? 0) > 0);

  const sort = SORTS[(get("SortBy") ?? "SortName").split(",")[0]!];
  if (sort) pool = [...pool].sort(sort);
  if (get("SortOrder") === "Descending") pool.reverse();
  const start = Number(get("StartIndex") ?? 0);
  const limit = Number(get("Limit") ?? pool.length);
  return list(pool.slice(start, start + limit), pool.length);
}

function languages(libraryId: string | null) {
  const collect = (type: string) => {
    const codes = new Set<string>();
    for (const item of LAB_ITEMS) if (!libraryId || item.ParentId === libraryId) for (const lang of langOf(item, type)) if (lang) codes.add(lang);
    return [...codes].sort().map((code) => ({ Name: code, Value: code }));
  };
  return { AudioLanguages: collect("Audio"), SubtitleLanguages: collect("Subtitle") };
}

function similarTo(id: string): MediaItem[] {
  const source = labItem(id);
  const genres = new Set(source?.Genres ?? []);
  const close = LAB_ITEMS.filter((item) => item.Id !== id && item.Genres?.some((g) => genres.has(g)));
  const rest = LAB_ITEMS.filter((item) => item.Id !== id && !close.includes(item));
  return [...close, ...rest].slice(0, 12);
}

const never = <T,>(): Promise<T> => new Promise<T>(() => undefined);

/** Répond à un chemin Jellyfin (`client.fetch(path)`). Un chemin inconnu rend une liste vide, et le dit. */
export async function labJellyfin<T>(path: string): Promise<T> {
  const url = new URL(path, "http://lab.invalid");
  const { pathname: p, searchParams: q } = url;
  const ok = (body: unknown): T => body as T;

  if (/^\/Users\/[^/]+\/Views$/.test(p)) return ok(list(LAB_LIBRARIES as unknown as MediaItem[]));
  if (state === "loading") return never<T>();
  if (state === "error") throw new Error("Labo : panne simulée");

  if (/^\/Users\/[^/]+\/Items\/Latest$/.test(p)) {
    const parent = q.get("ParentId") ?? q.get("parentId");
    return ok(LAB_ITEMS.filter((item) => !parent || item.ParentId === parent).sort(SORTS.DateCreated!).reverse().slice(0, 16));
  }
  if (/^\/Users\/[^/]+\/Items\/Resume$/.test(p)) return ok(list(LAB_ITEMS.filter((item) => (item.UserData?.PlaybackPositionTicks ?? 0) > 0)));
  if (p === "/Items/Filters2") return ok(languages(q.get("parentId")));
  const one = /^\/Users\/[^/]+\/Items\/([^/]+)$/.exec(p) ?? /^\/Items\/([^/]+)$/.exec(p);
  if (one) {
    const found = labItem(one[1]!) ?? labPerson(one[1]!)?.person;
    if (!found) throw Object.assign(new Error("Labo : titre inconnu"), { status: 404 });
    return ok(found);
  }
  if (/^\/Users\/[^/]+\/Items$/.test(p) || p === "/Items") return ok(queryItems(q));
  if (p === "/Genres") return ok(list(labGenres(q.get("ParentId") ?? q.get("parentId") ?? undefined) as unknown as MediaItem[]));
  const similar = /^\/Items\/([^/]+)\/Similar$/.exec(p);
  if (similar) return ok(list(similarTo(similar[1]!)));
  if (/^\/Shows\/[^/]+\/Seasons$/.test(p)) return ok(list(LAB_SEASONS));
  if (/^\/Shows\/[^/]+\/Episodes$/.test(p)) {
    const season = q.get("SeasonId") ?? q.get("seasonId");
    return ok(list(LAB_EPISODE_ITEMS.filter((episode) => !season || episode.SeasonId === season)));
  }
  if (p === "/Shows/NextUp") return ok(list(LAB_EPISODE_ITEMS.filter((episode) => episode.Id === `${LAB_SERIES_ID}2`)));
  if (/\/(SpecialFeatures|LocalTrailers|Intros|Ancestors|AdditionalParts|ThemeMedia)$/.test(p)) return ok([]);
  // « Inclus dans » : les films du studio appartiennent à la collection de démonstration.
  const inside = /^\/Items\/([^/]+)\/Collections$/.exec(p);
  if (inside) return ok(list(LAB_COLLECTION_TITLES.includes(inside[1]!) ? [labItem(LAB_COLLECTION_ID)!] : []));

  console.warn(`[labo fiches] chemin sans réponse : ${p}${url.search}`);
  return ok(list([]));
}
