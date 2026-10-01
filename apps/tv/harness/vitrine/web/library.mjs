// La bibliothèque du faux serveur web : l'instantané LIBRE de la vitrine
// (`snapshot/<langue>/snapshot.json`), indexé et interrogé comme Jellyfin
// répond à `/Users/{id}/Items` — filtres, tris, pages. Rien d'autre que le
// catalogue de la vitrine : ni compte réel, ni donnée inventée.
import fs from "node:fs";
import path from "node:path";
import { SNAPSHOT } from "../lib/paths.mjs";

/** L'utilisateur de démonstration (jamais un compte réel). */
export const DEMO_USER_ID = "7e5f1a0c2b9d4e6f8a1b3c5d7e9f0a2b";

const cache = new Map();

/** La bibliothèque d'une langue, chargée une fois (relue si le fichier change). */
export function loadLibrary(lang) {
  const file = path.join(SNAPSHOT, lang, "snapshot.json");
  const mtime = fs.statSync(file).mtimeMs;
  const hit = cache.get(lang);
  if (hit && hit.mtime === mtime) return hit.library;
  const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
  const library = indexSnapshot(snapshot, lang);
  cache.set(lang, { mtime, library });
  return library;
}

function indexSnapshot(snapshot, lang) {
  const byId = new Map(Object.entries(snapshot.items).map(([id, entry]) => [id, entry.item]));
  const imagesOf = (id) => snapshot.items[id]?.images ?? {};
  const libraryOf = new Map();
  for (const [libId, ids] of Object.entries(snapshot.catalog)) for (const id of ids) libraryOf.set(id, libId);
  // Les épisodes et saisons rattachés à la bibliothèque de leur série.
  for (const [seriesId, seasonIds] of Object.entries(snapshot.seasons)) {
    for (const seasonId of seasonIds) {
      libraryOf.set(seasonId, libraryOf.get(seriesId));
      for (const episodeId of snapshot.episodes[seasonId] ?? []) libraryOf.set(episodeId, libraryOf.get(seriesId));
    }
  }
  return { snapshot, lang, byId, imagesOf, libraryOf, user: demoUser(snapshot.profile.name) };
}

function demoUser(name) {
  return {
    Id: DEMO_USER_ID,
    Name: name,
    ServerId: "tentacle-vitrine",
    HasPassword: true,
    HasConfiguredPassword: true,
    EnableAutoLogin: false,
    Configuration: { PlayDefaultAudioTrack: true, SubtitleMode: "Default", HidePlayedInLatest: false },
    // Administrateur : les écrans du bureau montrent alors tout ce qu'ils savent montrer.
    Policy: { IsAdministrator: true, IsDisabled: false, EnableContentDownloading: true, EnableAllFolders: true },
  };
}

/** Un élément tel que Jellyfin le rend, avec l'état du compte de démo. */
export const itemOf = (library, id) => library.byId.get(id) ?? null;

const lower = (value) => String(value ?? "").toLowerCase();
const listParam = (params, name) => (params.get(name) ?? "").split(",").map((v) => v.trim()).filter(Boolean);

function matchesFilters(item, filters) {
  const data = item.UserData ?? {};
  return filters.every((filter) => {
    switch (filter) {
      case "IsFavorite": return !!data.IsFavorite;
      case "Likes": return data.Likes === true;
      case "IsPlayed": return !!data.Played;
      case "IsUnplayed": return !data.Played;
      case "IsResumable": return (data.PlaybackPositionTicks ?? 0) > 0;
      default: return true;
    }
  });
}

const SORT_KEYS = {
  SortName: (item) => lower(item.SortName ?? item.Name),
  Name: (item) => lower(item.Name),
  DateCreated: (item) => item.DateCreated ?? "",
  DatePlayed: (item) => item.UserData?.LastPlayedDate ?? "",
  PremiereDate: (item) => item.PremiereDate ?? String(item.ProductionYear ?? ""),
  ProductionYear: (item) => item.ProductionYear ?? 0,
  CommunityRating: (item) => item.CommunityRating ?? 0,
  Runtime: (item) => item.RunTimeTicks ?? 0,
  ParentIndexNumber: (item) => item.ParentIndexNumber ?? 0,
  IndexNumber: (item) => item.IndexNumber ?? 0,
};

function sortItems(items, params) {
  const keys = listParam(params, "SortBy");
  const descending = lower(params.get("SortOrder")).startsWith("desc");
  if (keys.includes("Random")) return items; // ordre stable : une capture se rejoue à l'identique
  if (!keys.length) return items;
  return [...items].sort((a, b) => {
    for (const key of keys) {
      const pick = SORT_KEYS[key];
      if (!pick) continue;
      const [x, y] = [pick(a), pick(b)];
      if (x < y) return descending ? 1 : -1;
      if (x > y) return descending ? -1 : 1;
    }
    return 0;
  });
}

/** Le moteur de `/Users/{id}/Items` (et `/Items?userId=`) : rend { Items, TotalRecordCount }. */
export function queryItems(library, params) {
  const get = (name) => params.get(name) ?? params.get(name.charAt(0).toLowerCase() + name.slice(1));
  let items = [...library.byId.values()].filter((item) => item.Type !== "Person");
  const ids = (get("Ids") ?? "").split(",").filter(Boolean);
  const parentId = get("ParentId");
  const recursive = lower(get("Recursive")) === "true";
  if (ids.length) {
    items = ids.map((id) => library.byId.get(id)).filter(Boolean);
  } else if (parentId) {
    // Sans récursion : les enfants directs (bibliothèque → films et séries,
    // série → saisons, saison → épisodes). Avec : tout ce qui vit dessous.
    items = recursive
      ? items.filter((item) => library.libraryOf.get(item.Id) === parentId || item.SeriesId === parentId || item.ParentId === parentId)
      : items.filter((item) => item.ParentId === parentId || (item.Type === "Season" && item.SeriesId === parentId));
  } else if (!recursive) {
    items = items.filter((item) => item.Type === "Movie" || item.Type === "Series");
  }
  const types = listParam(params, "IncludeItemTypes").concat(listParam(params, "includeItemTypes"));
  if (types.length) items = items.filter((item) => types.includes(item.Type));
  else if (!ids.length && recursive) items = items.filter((item) => item.Type !== "Season");
  const excluded = listParam(params, "ExcludeItemTypes");
  if (excluded.length) items = items.filter((item) => !excluded.includes(item.Type));
  const filters = listParam(params, "Filters");
  if (filters.length) items = items.filter((item) => matchesFilters(item, filters));
  if (lower(get("IsFavorite")) === "true") items = items.filter((item) => item.UserData?.IsFavorite);
  if (lower(get("IsPlayed")) === "true") items = items.filter((item) => item.UserData?.Played);
  if (lower(get("IsPlayed")) === "false") items = items.filter((item) => !item.UserData?.Played);
  const term = lower(get("SearchTerm") ?? get("searchTerm"));
  if (term) items = items.filter((item) => lower(item.Name).includes(term) || lower(item.OriginalTitle).includes(term));
  const genres = listParam(params, "Genres");
  if (genres.length) items = items.filter((item) => (item.Genres ?? []).some((g) => genres.includes(g)));
  const genreIds = listParam(params, "GenreIds");
  if (genreIds.length) items = items.filter((item) => (item.GenreItems ?? []).some((g) => genreIds.includes(g.Id)));
  const personIds = listParam(params, "PersonIds");
  if (personIds.length) items = items.filter((item) => (item.People ?? []).some((p) => personIds.includes(p.Id)));
  const years = listParam(params, "Years").map(Number);
  if (years.length) items = items.filter((item) => years.includes(item.ProductionYear));
  items = sortItems(items, params);
  const total = items.length;
  const start = Number(get("StartIndex") ?? 0);
  const limit = Number(get("Limit") ?? 0);
  items = items.slice(start, limit ? start + limit : undefined);
  return { Items: items, TotalRecordCount: total, StartIndex: start };
}

/** Les bibliothèques, en dossiers de collection Jellyfin. */
export function viewsOf(library) {
  return library.snapshot.libraries.map((lib) => ({
    Id: lib.id,
    Name: lib.name,
    ServerId: "tentacle-vitrine",
    Type: "CollectionFolder",
    CollectionType: lib.collectionType,
    IsFolder: true,
    ImageTags: {},
    BackdropImageTags: [],
    ChildCount: library.snapshot.catalog[lib.id]?.length ?? 0,
  }));
}

/** Les éléments d'une liste de l'instantané (`resume`, `nextUp`, `latest`…). */
export function listItems(library, name) {
  return (library.snapshot.lists[name] ?? []).map((id) => library.byId.get(id)).filter(Boolean);
}
