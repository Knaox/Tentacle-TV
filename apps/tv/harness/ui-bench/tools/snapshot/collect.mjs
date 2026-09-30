// Ce que l'instantané retient du compte : ~80 titres variés (films, séries à
// plusieurs saisons, animés, sagas), les épisodes de quelques séries, des
// personnes, et les états réels — reprise, vu, favori, Ma liste, notes. Les
// requêtes sont celles de l'app TV (mêmes chemins, mêmes champs), si bien que
// les objets gardés sont ceux que les vues recevront une fois branchées.
import { pool } from "./api.mjs";

const LIST_FIELDS = "Overview,Genres,Taglines,PrimaryImageAspectRatio,MediaSources,ProviderIds,Studios,ChildCount,RecursiveItemCount,Trickplay,PremiereDate,OfficialRating";
const DETAIL_FIELDS = "Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds,Chapters,ParentId,Trickplay,RemoteTrailers,SeriesId,SeasonId,Status,ChildCount,RecursiveItemCount,PremiereDate,EndDate,OfficialRating";
const IMAGES = "EnableImageTypes=Primary,Backdrop,Thumb,Logo&ImageTypeLimit=1&EnableUserData=true";

const uniq = (ids) => [...new Set(ids.filter(Boolean))];
const isAnime = (item, animeLibraries) =>
  animeLibraries.has(item.ParentId) || (item.Genres ?? []).some((genre) => /anim/i.test(genre));

export async function collect(api, userId, log) {
  const U = userId;
  const items = new Map();
  const keep = (list) => {
    for (const item of list ?? []) if (item?.Id && !items.has(item.Id)) items.set(item.Id, item);
    return (list ?? []).map((item) => item.Id);
  };
  const query = (params) => api.jellyfin(`/Users/${U}/Items?${params}&Fields=${LIST_FIELDS}&${IMAGES}`);

  log("bibliothèques");
  const views = (await api.jellyfin(`/Users/${U}/Views`)).Items ?? [];
  const libraries = views.map((view) => ({ id: view.Id, name: view.Name, collectionType: view.CollectionType ?? null }));
  const animeLibraries = new Set(libraries.filter((lib) => /anim/i.test(lib.name)).map((lib) => lib.id));

  log("rangées de l'accueil");
  const resume = keep((await api.jellyfin(`/Users/${U}/Items/Resume?Limit=12&Recursive=true&IncludeItemTypes=Movie,Episode&MediaTypes=Video&Fields=${LIST_FIELDS}&${IMAGES}`)).Items);
  const nextUp = keep((await api.jellyfin(`/Shows/NextUp?userId=${U}&Limit=12&DisableFirstEpisode=true&EnableResumable=false&Fields=${LIST_FIELDS}&${IMAGES}`)).Items);
  const watchlist = keep((await query("Filters=Likes&Recursive=true&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending&Limit=24")).Items);
  const favorites = keep((await query("Filters=IsFavorite&Recursive=true&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending&Limit=24")).Items);
  const watched = keep((await query("Filters=IsPlayed&Recursive=true&IncludeItemTypes=Movie,Episode&SortBy=DatePlayed&SortOrder=Descending&Limit=16")).Items);
  const latest = [];
  const latestByLibrary = {};
  const catalog = {};
  const genres = {};
  for (const lib of libraries) {
    const type = lib.collectionType === "tvshows" ? "Series" : lib.collectionType === "movies" ? "Movie" : "Movie,Series";
    latestByLibrary[lib.id] = keep((await query(`ParentId=${lib.id}&Recursive=true&IncludeItemTypes=${type}&SortBy=DateCreated&SortOrder=Descending&Limit=12`)).Items);
    latest.push(...latestByLibrary[lib.id]);
    // Le catalogue d'une bibliothèque, tel que la grille le demande (titre A→Z).
    catalog[lib.id] = keep((await query(`ParentId=${lib.id}&Recursive=true&IncludeItemTypes=Movie,Series&ExcludeLocationTypes=Virtual&IsMissing=false&SortBy=SortName&SortOrder=Ascending&Limit=48`)).Items);
    genres[lib.id] = ((await api.optional(api.jellyfin(`/Genres?ParentId=${lib.id}&UserId=${U}`), `genres ${lib.name}`))?.Items ?? []).map((g) => ({ id: g.Id, name: g.Name }));
  }

  log("titres variés");
  const movies = keep((await query("Recursive=true&IncludeItemTypes=Movie&SortBy=CommunityRating,SortName&SortOrder=Descending&Limit=24")).Items);
  const allSeries = (await query("Recursive=true&IncludeItemTypes=Series&SortBy=DateLastContentAdded&SortOrder=Descending&Limit=60")).Items ?? [];
  const anime = keep(allSeries.filter((series) => isAnime(series, animeLibraries)).slice(0, 8));
  const series = keep(allSeries.filter((series) => !isAnime(series, animeLibraries))
    .sort((a, b) => (b.ChildCount ?? 0) - (a.ChildCount ?? 0)).slice(0, 12));
  const collections = keep((await query("Recursive=true&IncludeItemTypes=BoxSet&SortBy=SortName&Limit=6")).Items);

  log(`fiches complètes de ${items.size} éléments`);
  const titleIds = [...items.keys()];
  await pool(titleIds.map((id) => async () => {
    const detail = await api.optional(api.jellyfin(`/Users/${U}/Items/${id}?Fields=${DETAIL_FIELDS}&EnableUserData=true`), `fiche ${id}`);
    if (detail) items.set(id, detail);
  }));

  // Les séries des épisodes (reprise, à suivre) : leur fiche sert au héros et à
  // la fiche d'un épisode.
  const parentSeries = uniq([...items.values()].map((item) => item.SeriesId)).filter((id) => !items.has(id));
  await pool(parentSeries.map((id) => async () => {
    const detail = await api.optional(api.jellyfin(`/Users/${U}/Items/${id}?Fields=${DETAIL_FIELDS}&EnableUserData=true`), `série ${id}`);
    if (detail) items.set(id, detail);
  }));

  log("saisons et épisodes");
  const seriesPool = [...items.values()].filter((item) => item.Type === "Series");
  const deep = uniq([
    ...seriesPool.sort((a, b) => (b.ChildCount ?? 0) - (a.ChildCount ?? 0)).slice(0, 3).map((s) => s.Id),
    ...seriesPool.filter((s) => isAnime(s, animeLibraries)).slice(0, 1).map((s) => s.Id),
    ...[...items.values()].filter((item) => item.Type === "Episode").slice(0, 2).map((ep) => ep.SeriesId),
  ]).slice(0, 6);
  const seasons = {};
  const episodes = {};
  for (const seriesId of deep) {
    const seasonList = (await api.optional(api.jellyfin(`/Shows/${seriesId}/Seasons?userId=${U}&Fields=PrimaryImageAspectRatio,RemoteTrailers,RecursiveItemCount,ChildCount&${IMAGES}`), `saisons ${seriesId}`))?.Items ?? [];
    seasons[seriesId] = keep(seasonList.slice(0, 15));
    for (const season of seasonList.slice(0, 15)) {
      const list = (await api.optional(api.jellyfin(`/Shows/${seriesId}/Episodes?SeasonId=${season.Id}&userId=${U}&Fields=Overview,PrimaryImageAspectRatio,MediaSources,Trickplay&EnableUserData=true&EnableImageTypes=Primary,Thumb&ImageTypeLimit=1`), `épisodes ${season.Id}`))?.Items ?? [];
      episodes[season.Id] = keep(list.slice(0, 80));
    }
  }

  log("personnes et sagas");
  const cast = [];
  for (const item of items.values()) {
    for (const person of item.People ?? []) {
      if (person.PrimaryImageTag && !cast.some((p) => p.Id === person.Id)) cast.push(person);
    }
  }
  const people = cast.slice(0, 16).map((person) => {
    items.set(person.Id, { Id: person.Id, Name: person.Name, Type: "Person", Role: person.Role, PersonType: person.Type, ImageTags: { Primary: person.PrimaryImageTag } });
    return person.Id;
  });
  const credits = {};
  for (const personId of people.slice(0, 4)) {
    credits[personId] = keep((await api.optional(query(`PersonIds=${personId}&Recursive=true&IncludeItemTypes=Movie,Series&SortBy=ProductionYear&SortOrder=Descending&Limit=20`), `filmographie ${personId}`))?.Items);
  }
  for (const boxSetId of collections) {
    credits[boxSetId] = keep((await api.optional(api.jellyfin(`/Users/${U}/Items?ParentId=${boxSetId}&SortBy=PremiereDate,SortName&SortOrder=Ascending&Fields=${LIST_FIELDS}&${IMAGES}`), `saga ${boxSetId}`))?.Items);
  }

  log("notes, recommandations, réglages");
  const ratings = {};
  const ratingRows = (await api.optional(api.tentacle("/api/ratings"), "notes")) ?? [];
  const byTmdb = new Map();
  for (const item of items.values()) if (item.ProviderIds?.Tmdb) byTmdb.set(`${item.Type === "Series" ? "series" : "movie"}:${item.ProviderIds.Tmdb}`, item.Id);
  for (const row of ratingRows) {
    const id = row.jellyfinItemId ?? (row.seasonNumber || row.episodeNumber ? null : byTmdb.get(`${row.mediaType}:${row.tmdbId}`));
    if (id && items.has(id)) ratings[id] = row.score;
  }
  const recoSettings = await api.optional(api.tentacle("/api/preferences/reco"), "réglages reco");
  const providers = recoSettings?.settings?.providerFilter ?? [];
  const recoPage = await api.optional(api.tentacle(`/api/reco/page${providers.length ? `?providers=${providers.join(",")}` : ""}`), "page reco");
  const shelves = (recoPage?.rows ?? []).map((row) => ({
    id: row.key,
    title: row.seedTitle ? `${row.key} · ${row.seedTitle}` : row.key,
    itemIds: (row.items ?? []).map((reco) => reco.jellyfinItemId).filter(Boolean),
  })).filter((shelf) => shelf.itemIds.length > 0);
  const missingReco = uniq(shelves.flatMap((shelf) => shelf.itemIds)).filter((id) => !items.has(id)).slice(0, 40);
  await pool(missingReco.map((id) => async () => {
    const detail = await api.optional(api.jellyfin(`/Users/${U}/Items/${id}?Fields=${DETAIL_FIELDS}&EnableUserData=true`), `reco ${id}`);
    if (detail) items.set(id, detail);
  }));

  log("fiches : similaires, bonus, sagas");
  const detail = {};
  const detailIds = [...movies.slice(0, 8), ...series.slice(0, 4), ...anime.slice(0, 2)];
  for (const id of detailIds) {
    const it = items.get(id);
    if (!it) continue;
    const entry = {};
    entry.similar = keep((await api.optional(api.jellyfin(`/Items/${id}/Similar?userId=${U}&Limit=12&Fields=${LIST_FIELDS}&${IMAGES}`), `similaires ${id}`))?.Items);
    entry.specialFeatures = keep(await api.optional(api.jellyfin(`/Users/${U}/Items/${id}/SpecialFeatures`), `bonus ${id}`) ?? []);
    entry.localTrailers = keep(await api.optional(api.jellyfin(`/Users/${U}/Items/${id}/LocalTrailers`), `bandes-annonces ${id}`) ?? []);
    const tmdb = it.ProviderIds?.Tmdb;
    if (tmdb) entry.remoteTrailers = await api.optional(api.tentacle(`/api/tmdb/trailers?tmdbId=${tmdb}&mediaType=${it.Type === "Series" ? "tv" : "movie"}`), `vidéos ${id}`);
    const collection = it.ProviderIds?.TmdbCollection;
    if (collection) entry.saga = await api.optional(api.tentacle(`/api/sagas/${collection}?lang=fr`), `saga ${id}`);
    detail[id] = entry;
  }

  const extras = {
    homeLayout: await api.optional(api.tentacle("/api/preferences/home-layout"), "mise en page de l'accueil"),
    recoState: recoPage ? { state: recoPage.state, generating: recoPage.generating, rows: recoPage.rows } : null,
    trailerReadiness: await api.optional(api.tentacle("/api/trailers/readiness"), "bandes-annonces"),
    searchDiscover: await api.optional(api.tentacle("/api/search/discover"), "recherche · genres"),
  };
  const sample = [...items.values()].find((item) => item.Type === "Movie")?.Name?.split(/\s+/)[0];
  if (sample) extras.search = { query: sample, response: await api.optional(api.tentacle(`/api/search?q=${encodeURIComponent(sample)}&limit=12`), "recherche") };

  const episodeIds = [...items.values()].filter((item) => item.Type === "Episode").map((item) => item.Id);
  return {
    items,
    libraries,
    lists: { movies, series, anime, episodes: episodeIds, resume, nextUp, latest, favorites, watchlist, people, collections, watched },
    latestByLibrary,
    catalog,
    genres,
    detail,
    seasons,
    episodes,
    credits,
    ratings,
    shelves,
    extras,
  };
}
