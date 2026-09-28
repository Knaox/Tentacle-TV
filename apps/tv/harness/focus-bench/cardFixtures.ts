import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CURRENT_EPISODE, SERIES_ID } from "./fixtures";

/**
 * Les cartes de la scène « Cartes et feuille d'actions » : chaque état que
 * le modèle des cartes sait dire — reprise, vu, favori, Ma liste (au niveau
 * série pour une série et ses épisodes), note perso entière ou en demi-étoile,
 * tuile de lot « +N », collection sans lecture, épisode sans flux (comme un
 * résultat de recherche) —, et les recommandations d'une bibliothèque.
 *
 * Les flux vivent sous `MediaSources[0]` : c'est là que `extractMediaQuality`
 * les lit (la série du panneau des épisodes les porte à la racine, où les
 * puces ne les voient pas).
 */

const MINUTE = 60 * 10_000_000;
export const SECOND_SERIES_ID = "bench-series-2";

const SOURCE_4K = [{
  Id: "bench-source-4k",
  MediaStreams: [
    { Type: "Video", Width: 3840, Height: 2160, Codec: "hevc", VideoRangeType: "HDR10" },
    { Type: "Audio", Language: "fre", Codec: "truehd", Channels: 8, DisplayTitle: "Français - TrueHD Atmos 7.1", IsDefault: true },
    { Type: "Audio", Language: "eng", Codec: "eac3", Channels: 6 },
  ],
}];
const SOURCE_HD = [{
  Id: "bench-source-hd",
  MediaStreams: [
    { Type: "Video", Width: 1920, Height: 1080, Codec: "h264" },
    { Type: "Audio", Language: "jpn", Codec: "aac", Channels: 2, IsDefault: true },
  ],
}];

const image = { ImageTags: { Primary: "bench" }, BackdropImageTags: ["bench"] };

export const SERIES_ITEM = {
  Id: SERIES_ID, Name: "Les Chroniques du banc", Type: "Series", ProductionYear: 2021,
  CommunityRating: 8.4, ProviderIds: { Tmdb: "1399" }, ...image,
  UserData: { Played: false, IsFavorite: false, Likes: true, PlaybackPositionTicks: 0 },
} as unknown as MediaItem;

export const SECOND_SERIES_ITEM = {
  Id: SECOND_SERIES_ID, Name: "Horizon lointain", Type: "Series", ProductionYear: 2024,
  CommunityRating: 7.6, ProviderIds: { Tmdb: "94605" }, ...image,
  UserData: { Played: false, IsFavorite: true, Likes: false, PlaybackPositionTicks: 0 },
} as unknown as MediaItem;

function movie(id: string, name: string, year: number, rating: number, tmdb: string, userData: object, extra: object = {}): MediaItem {
  return {
    Id: id, Name: name, Type: "Movie", ProductionYear: year, CommunityRating: rating,
    ProviderIds: { Tmdb: tmdb }, RunTimeTicks: 128 * MINUTE, ...image,
    UserData: { Played: false, IsFavorite: false, Likes: false, PlaybackPositionTicks: 0, ...userData },
    ...extra,
  } as unknown as MediaItem;
}

function episode(id: string, season: number, index: number, name: string, userData: object, extra: object = {}): MediaItem {
  return {
    Id: id, Name: name, Type: "Episode", SeriesId: SERIES_ID, SeriesName: SERIES_ITEM.Name,
    SeasonId: `bench-season-${season}`, ParentIndexNumber: season, IndexNumber: index,
    RunTimeTicks: 24 * MINUTE, CommunityRating: 7.8, ProviderIds: { Tmdb: `ep-${id}` },
    SeriesPrimaryImageTag: "bench", ...image,
    UserData: { Played: false, IsFavorite: false, Likes: false, PlaybackPositionTicks: 0, ...userData },
    ...extra,
  } as unknown as MediaItem;
}

const MOVIE_RESUME = movie("bench-movie-a", "Le Dernier Signal", 2019, 7.9, "603",
  { Likes: true, PlaybackPositionTicks: 51 * MINUTE, PlayedPercentage: 40 }, { MediaSources: SOURCE_HD });
const MOVIE_WATCHED = movie("bench-movie-b", "Marée haute", 2023, 6.5, "550",
  { Played: true, IsFavorite: true }, { MediaSources: SOURCE_4K });
const MOVIE_FRESH = movie("bench-movie-c", "Les Heures claires", 2025, 7.2, "680", {});
const MOVIE_OTHER = movie("bench-movie-d", "Cartographie du silence", 2022, 8.1, "13", {});

const GROUPED = {
  Id: SECOND_SERIES_ID, Name: SECOND_SERIES_ITEM.Name, Type: "Series", RecentlyAddedCount: 3, ...image,
  UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false },
} as unknown as MediaItem;

const COLLECTION = {
  Id: "bench-collection", Name: "Trilogie du banc", Type: "BoxSet", ProductionYear: 2018, ...image,
  UserData: { Played: false, IsFavorite: false, Likes: false, PlaybackPositionTicks: 0 },
} as unknown as MediaItem;

const EPISODE_RESUME = { ...CURRENT_EPISODE, MediaSources: SOURCE_4K, CommunityRating: 8.2,
  ProviderIds: { Tmdb: "ep-s2e41" }, UserData: { ...CURRENT_EPISODE.UserData, PlayedPercentage: 21 } } as unknown as MediaItem;
const EPISODE_WATCHED = episode("bench-s1e3", 1, 3, "La carte et le territoire", { Played: true });
const EPISODE_BARE = episode("bench-s3e1", 3, 1, "Retour au port", {});

/** L'affiche 2:3 (rangées, grilles). */
export const POSTER_CARDS: MediaItem[] = [MOVIE_RESUME, MOVIE_WATCHED, SERIES_ITEM, GROUPED, EPISODE_RESUME, COLLECTION, MOVIE_FRESH];

/** La vignette 16:9 (Reprendre, Prochains, Déjà vu) — OK lance la lecture. */
export const STILL_CARDS: MediaItem[] = [EPISODE_RESUME, EPISODE_WATCHED, EPISODE_BARE, MOVIE_RESUME];

/** Tout ce qu'une fiche peut demander, par identifiant (`/Users/…/Items/<id>`). */
export const CARD_ITEMS: MediaItem[] = [
  MOVIE_RESUME, MOVIE_WATCHED, MOVIE_FRESH, MOVIE_OTHER, SERIES_ITEM, SECOND_SERIES_ITEM,
  COLLECTION, EPISODE_RESUME, EPISODE_WATCHED, EPISODE_BARE,
];

/** Les épisodes de la seconde série — aucun vu : « Lire S01E01 ». */
export const SECOND_SERIES_EPISODES: MediaItem[] = Array.from({ length: 6 }, (_, i) => ({
  Id: `bench-2-s1e${i + 1}`, Name: `Épisode ${i + 1}`, Type: "Episode", SeriesId: SECOND_SERIES_ID,
  ParentIndexNumber: 1, IndexNumber: i + 1, UserData: { Played: false, PlaybackPositionTicks: 0 },
})) as unknown as MediaItem[];

function reco(key: string, item: MediaItem, extra: Partial<RecoRowItem>): RecoRowItem {
  return {
    key, mediaType: item.Type === "Series" ? "tv" : "movie", tmdbId: Number(item.ProviderIds?.Tmdb),
    title: item.Name, year: item.ProductionYear ?? null, posterPath: null, jellyfinItemId: item.Id,
    source: "bench", score: 0.9, voteAverage: item.CommunityRating ?? null, reasons: [], ...extra,
  };
}

/** Les recommandations — en bibliothèque, comme sur le téléviseur. */
export const RECO_CARDS: RecoRowItem[] = [
  reco("movie:680", MOVIE_FRESH, { exploration: true, reasons: [{ kind: "exploration", label: "Une découverte hors de vos habitudes" }] }),
  reco("tv:94605", SECOND_SERIES_ITEM, { reasons: [{ kind: "seed", label: "Parce que vous avez aimé Marée haute" }] }),
  reco("movie:13", MOVIE_OTHER, { reasons: [{ kind: "facet", label: "Drame · Science-fiction" }] }),
];
