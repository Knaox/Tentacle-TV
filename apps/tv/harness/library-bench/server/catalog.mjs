// Le catalogue du banc des bibliothèques : des titres RÉELS de l'instantané du
// banc UI (`ui-bench/snapshot`, compte de test), multipliés jusqu'à former une
// grosse bibliothèque « Films » (1 200 titres par défaut) et une « Séries ».
// Rendus comme Jellyfin 10.11 les rendrait : seulement les champs qu'il donne
// SANS `Fields`, plus ceux qu'une requête demande (MediaSources, Overview…).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

export const SERVER_ID = "banc";
export const USER = { Id: "banc-user", Name: "Banc", ServerId: SERVER_ID, Policy: { IsAdministrator: false } };
export const LIB_FILMS = md5("banc-lib-films");
export const LIB_SERIES = md5("banc-lib-series");

// Les champs que Jellyfin 10.11 rend SANS `Fields` (le reste n'arrive que demandé).
const BASE_KEYS = ["Name", "OriginalTitle", "Container", "PremiereDate", "CriticRating", "OfficialRating", "CommunityRating", "RunTimeTicks", "ProductionYear", "IsFolder", "Type", "VideoType", "LocationType", "MediaType", "HasSubtitles", "IsHD", "Width", "Height"];

const firstHash = (hashes) => (hashes ? Object.values(hashes)[0] : null);

function makeItem(src, i, kind, libId, cycleLength) {
  const cycle = Math.floor(i / cycleLength);
  const id = md5(`banc-${kind}-${i}`);
  const base = { ServerId: SERVER_ID, Id: id, ChannelId: null };
  for (const k of BASE_KEYS) if (src[k] !== undefined) base[k] = src[k];
  base.Name = cycle > 0 ? `${src.Name} ${cycle + 1}` : src.Name;
  const primaryTag = md5(`p-${id}`);
  const backdropTag = md5(`b-${id}`);
  const primaryHash = firstHash(src.ImageBlurHashes?.Primary);
  const backdropHash = firstHash(src.ImageBlurHashes?.Backdrop);
  base.ImageTags = { Primary: primaryTag };
  base.BackdropImageTags = backdropHash ? [backdropTag] : [];
  base.ImageBlurHashes = {};
  if (primaryHash) base.ImageBlurHashes.Primary = { [primaryTag]: primaryHash };
  if (backdropHash) base.ImageBlurHashes.Backdrop = { [backdropTag]: backdropHash };
  // Des états variés : vus, en cours, favoris — les marqueurs se dessinent.
  const r = parseInt(id.slice(0, 6), 16) % 100;
  const played = r < 12;
  const progress = !played && r < 18 ? 20 + (r * 7) % 60 : 0;
  base.UserData = {
    PlaybackPositionTicks: progress ? Math.round(((src.RunTimeTicks ?? 6e10) * progress) / 100) : 0,
    PlayCount: played ? 1 : 0, IsFavorite: r % 17 === 0, Played: played, Key: id, ItemId: id,
    ...(progress ? { PlayedPercentage: progress } : {}),
  };
  return {
    base, kind, libId, src,
    // Le tri par titre suit l'ordre de fabrication : deux voisins ne sont
    // jamais la même affiche (les cycles de l'instantané ne se suivent pas).
    sortName: String(i).padStart(6, "0"),
    dateCreated: new Date(Date.UTC(2024, 0, 1) + i * 3_600_000 * 7).toISOString(),
  };
}

/** Le catalogue : films, séries, et l'index par identifiant. Seuls les titres
 *  dont l'affiche a été préparée (`prepareImages.mjs`) sont repris. */
export function loadCatalog({ snapDir, imgDir, films = 1200, series = 280 }) {
  const snap = JSON.parse(fs.readFileSync(path.join(snapDir, "snapshot.json"), "utf8"));
  const items = Object.values(snap.items).map((entry) => entry.item);
  const withPoster = (it) => fs.existsSync(path.join(imgDir, `${it.Id}-p480.jpg`));
  const movies = items.filter((it) => it.Type === "Movie" && withPoster(it));
  const shows = items.filter((it) => it.Type === "Series" && withPoster(it));
  if (!movies.length) throw new Error(`aucune affiche préparée dans ${imgDir} — lancer prepareImages.mjs`);
  const filmList = Array.from({ length: films }, (_, i) => makeItem(movies[i % movies.length], i, "Movie", LIB_FILMS, movies.length));
  const seriesList = Array.from({ length: series }, (_, i) => makeItem(shows[i % shows.length], i, "Series", LIB_SERIES, shows.length));
  return { films: filmList, series: seriesList, byId: new Map([...filmList, ...seriesList].map((e) => [e.base.Id, e])) };
}

const OPTIONAL = {
  ProviderIds: (src) => src.ProviderIds ?? {},
  Studios: (src) => src.Studios ?? [],
  Overview: (src) => src.Overview ?? "",
  Genres: (src) => src.Genres ?? [],
  Taglines: (src) => src.Taglines ?? [],
  People: (src) => src.People ?? [],
  GenreItems: (src) => src.GenreItems ?? [],
  ExternalUrls: (src) => src.ExternalUrls ?? [],
  RemoteTrailers: (src) => src.RemoteTrailers ?? [],
};

/** L'item tel que Jellyfin le rendrait pour ces `Fields`. */
export function render(entry, fields) {
  const out = { ...entry.base };
  const { src } = entry;
  if (fields.has("PrimaryImageAspectRatio")) out.PrimaryImageAspectRatio = 2 / 3;
  if (fields.has("RecursiveItemCount") && entry.kind === "Series") out.RecursiveItemCount = 10;
  if (fields.has("MediaSources") && src.MediaSources) out.MediaSources = src.MediaSources.map((ms) => ({ ...ms, Id: entry.base.Id }));
  if (fields.has("MediaStreams") && src.MediaStreams) out.MediaStreams = src.MediaStreams;
  if (fields.has("SortName")) out.SortName = entry.sortName;
  if (fields.has("DateCreated")) out.DateCreated = entry.dateCreated;
  if (fields.has("ParentId")) out.ParentId = entry.libId;
  if (fields.has("Trickplay")) out.Trickplay = {};
  for (const [field, value] of Object.entries(OPTIONAL)) if (fields.has(field)) out[field] = value(src);
  return out;
}

/** Le tri des requêtes `Items` (la clé principale de `SortBy`). */
export function compare(sortBy, order) {
  const dir = order === "Descending" ? -1 : 1;
  const key = sortBy.split(",")[0];
  return (a, b) => {
    let d = 0;
    if (key === "DateCreated") d = a.dateCreated.localeCompare(b.dateCreated);
    else if (key === "ProductionYear") d = (a.base.ProductionYear ?? 0) - (b.base.ProductionYear ?? 0);
    else if (key === "CommunityRating") d = (a.base.CommunityRating ?? 0) - (b.base.CommunityRating ?? 0);
    else d = a.sortName.localeCompare(b.sortName);
    return d * dir || a.base.Id.localeCompare(b.base.Id);
  };
}
