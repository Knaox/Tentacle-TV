// L'instantané VITRINE du banc UI : le même format que celui du compte de
// test (`ui-bench/data/snapshotFormat.ts`), mais fabriqué à partir du seul
// catalogue libre — un dossier par langue, les images partagées.
import fs from "node:fs";
import path from "node:path";
import { deriveImage } from "./images.mjs";
import { episodeItem, idOf, movieItem, personItem, seasonItem, seriesItem } from "./items.mjs";
import { CATALOG, LANGS, SNAPSHOT } from "./paths.mjs";

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(CATALOG, name), "utf8"));

/** Le type d'image tiré pour chaque clé du catalogue. */
const kindOf = (type, key) => (type === "Episode" && key === "Primary" ? "Still" : key);

function imagesOf(entry, type) {
  const derived = {};
  for (const [key, spec] of Object.entries(entry.images ?? {})) derived[kindOf(type, key)] = deriveImage(spec, kindOf(type, key), entry.slug);
  return derived;
}

/** Les chemins d'images de l'instantané, au format du banc. */
function imageMap(derived) {
  const map = {};
  for (const [kind, image] of Object.entries(derived)) map[kind === "Still" ? "Primary" : kind] = image.file;
  return map;
}

function loadCatalog() {
  return { titles: readJson("titles.json").titles, series: readJson("series.json").series, library: readJson("library.json") };
}

/** Tire toutes les images une fois (elles servent aux deux langues). */
function deriveAll(catalog) {
  const images = new Map();
  for (const entry of catalog.titles) images.set(entry.slug, imagesOf(entry, "Movie"));
  for (const series of catalog.series) {
    images.set(series.slug, imagesOf(series, "Series"));
    for (const season of series.seasons) for (const episode of season.episodes) images.set(episode.slug, imagesOf(episode, "Episode"));
  }
  return images;
}

function recoItemOf(entry, slugToItem, lang, reasons) {
  const item = slugToItem.get(entry.slug);
  return {
    key: `${item.Type === "Series" ? "tv" : "movie"}:${entry.slug}`,
    mediaType: item.Type === "Series" ? "tv" : "movie",
    tmdbId: 0,
    title: item.Name,
    year: item.ProductionYear,
    posterPath: null,
    backdropPath: null,
    jellyfinItemId: item.Id,
    source: "library",
    score: 1,
    voteAverage: null,
    providers: [],
    reasons: reasons.map((reason) =>
      reason.kind === "seed" ? { kind: "seed", seedTitle: slugToItem.get(reason.seed).Name } : { kind: reason.kind, key: reason.key, label: reason.label },
    ),
  };
}

function buildSnapshot(catalog, images, lang) {
  const { library } = catalog;
  const ctx = { genres: library.genres };
  const items = {};
  const slugToItem = new Map();
  const add = (slug, item, derived) => {
    items[item.Id] = { item, images: imageMap(derived) };
    slugToItem.set(slug, item);
  };
  for (const entry of catalog.titles) add(entry.slug, movieItem(entry, lang, { ...ctx, images: images.get(entry.slug) }), images.get(entry.slug));
  const seasons = {};
  const episodes = {};
  for (const series of catalog.series) {
    const seriesImages = images.get(series.slug);
    add(series.slug, seriesItem(series, lang, { ...ctx, images: seriesImages }), seriesImages);
    seasons[idOf(series.slug)] = [];
    for (const season of series.seasons) {
      const seasonEntry = seasonItem(series, season, lang, { seriesImages });
      items[seasonEntry.Id] = { item: seasonEntry, images: {} };
      seasons[idOf(series.slug)].push(seasonEntry.Id);
      episodes[seasonEntry.Id] = [];
      for (const episode of season.episodes) {
        const derived = images.get(episode.slug);
        add(episode.slug, episodeItem(series, season, episode, lang, { ...ctx, images: derived, seriesImages }), derived);
        episodes[seasonEntry.Id].push(idOf(episode.slug));
      }
    }
  }
  const people = [...new Set([...catalog.titles, ...catalog.series].flatMap((entry) => entry.directors ?? []))].map(personItem);
  for (const person of people) items[person.Id] = { item: person, images: {} };
  const credits = {};
  for (const entry of [...catalog.titles, ...catalog.series]) {
    for (const name of entry.directors ?? []) (credits[idOf(`person:${name}`)] ??= []).push(idOf(entry.slug));
  }

  const ids = (slugs) => slugs.map((slug) => idOf(slug));
  const all = [...catalog.titles, ...catalog.series];
  const allEpisodes = catalog.series.flatMap((series) => series.seasons.flatMap((season) => season.episodes));
  const flagged = (flag) => [...all, ...allEpisodes].filter((entry) => entry.state?.[flag]).map((entry) => idOf(entry.slug));
  const byAdded = [...all].sort((a, b) => (b.added ?? "").localeCompare(a.added ?? ""));
  const az = (list) => [...list].sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang)).map((entry) => idOf(entry.slug));
  const libraries = library.libraries.map((lib) => ({ id: idOf(`library:${lib.id}`), name: lib.name[lang], collectionType: lib.collectionType }));
  const inLibrary = (libId) => all.filter((entry) => entry.library === libId);
  const genresOf = (libId) =>
    [...new Set(inLibrary(libId).flatMap((entry) => entry.genres))]
      .map((key) => ({ id: idOf(`genre:${key}`), name: library.genres[key][lang] }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  const ratings = {};
  for (const entry of [...all, ...allEpisodes]) if (entry.state?.rating) ratings[idOf(entry.slug)] = entry.state.rating;
  const detail = {};
  for (const [slug, similar] of Object.entries(library.similar)) {
    detail[idOf(slug)] = { similar: ids(similar), specialFeatures: [], localTrailers: [], remoteTrailers: [] };
  }
  const genreCounts = new Map();
  for (const entry of all) for (const key of entry.genres) genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);

  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    account: "vitrine (contenu libre)",
    items,
    lists: {
      movies: az(catalog.titles),
      series: az(catalog.series),
      anime: [],
      episodes: ids(allEpisodes.map((episode) => episode.slug)),
      resume: ids(library.lists.resume),
      nextUp: ids(library.lists.nextUp),
      latest: ids(byAdded.map((entry) => entry.slug)),
      favorites: flagged("favorite"),
      watchlist: flagged("list"),
      watched: flagged("played"),
      people: people.map((person) => person.Id),
      collections: [],
    },
    seasons,
    episodes,
    credits,
    ratings,
    shelves: library.shelves.map((shelf) => ({ id: shelf.id, title: shelf.id, itemIds: ids(shelf.items) })),
    libraries,
    latestByLibrary: Object.fromEntries(
      library.lists.latestLibraries.map((libId) => [idOf(`library:${libId}`), ids(byAdded.filter((entry) => entry.library === libId).map((entry) => entry.slug))]),
    ),
    catalog: Object.fromEntries(library.libraries.map((lib) => [idOf(`library:${lib.id}`), az(inLibrary(lib.id))])),
    genres: Object.fromEntries(library.libraries.map((lib) => [idOf(`library:${lib.id}`), genresOf(lib.id)])),
    detail,
    profile: { name: library.profile[lang], image: null },
    extras: {
      homeLayout: { stored: false, layout: { heroMode: "resume", heroFixedItemId: null, rows: library.homeRows.map((key) => ({ key, enabled: true })) } },
      recoState: {
        state: "ready",
        generating: false,
        refining: false,
        rows: library.reco.map((row) => ({
          key: row.key,
          ...(row.seed ? { seedTitle: slugToItem.get(row.seed).Name } : {}),
          items: row.items.map((entry) => recoItemOf(entry, slugToItem, lang, entry.reasons)),
        })),
      },
      searchDiscover: {
        ready: true,
        genres: [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ name: library.genres[key][lang], count })),
      },
      trailerReadiness: { state: "ready", reasons: [], coverage: 1, checkedAt: new Date().toISOString() },
    },
  };
}

/** Tire les images et écrit `snapshot/<langue>/snapshot.json` pour chaque langue. */
export function writeSnapshots() {
  const catalog = loadCatalog();
  const images = deriveAll(catalog);
  for (const lang of LANGS) {
    const dir = path.join(SNAPSHOT, lang);
    fs.mkdirSync(dir, { recursive: true });
    // Les images sont communes : le dossier de chaque langue y pointe.
    const link = path.join(dir, "img");
    if (!fs.existsSync(link)) fs.symlinkSync("../img", link);
    const snapshot = buildSnapshot(catalog, images, lang);
    fs.writeFileSync(path.join(dir, "snapshot.json"), JSON.stringify(snapshot));
    console.log(`instantané ${lang} : ${Object.keys(snapshot.items).length} éléments → ${path.join(dir, "snapshot.json")}`);
  }
}
