import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Les données factices du banc : une série à trois saisons (12, 60 et 8
 * épisodes), un catalogue de films, des genres — et un client Jellyfin qui
 * les sert sans réseau ni compte.
 */

export const SERIES_ID = "bench-series";
const SEASON_SIZES = [12, 60, 8];

/** L'épisode « en cours » du panneau : saison 2, épisode 41. */
const CURRENT_SEASON = 2;
const CURRENT_INDEX = 41;

export const SEASONS = SEASON_SIZES.map((_, i) => ({
  Id: `bench-season-${i + 1}`,
  Name: `Saison ${i + 1}`,
  IndexNumber: i + 1,
  Type: "Season",
  SeriesId: SERIES_ID,
})) as unknown as MediaItem[];

function makeEpisode(season: number, index: number, full: boolean): MediaItem {
  const current = season === CURRENT_SEASON && index === CURRENT_INDEX;
  return {
    Id: `bench-s${season}e${index}`,
    Name: `Épisode ${index} — un titre assez long pour éprouver la coupure de la ligne`,
    IndexNumber: index,
    ParentIndexNumber: season,
    SeasonId: `bench-season-${season}`,
    SeriesId: SERIES_ID,
    Type: "Episode",
    RunTimeTicks: 24 * 60 * 10_000_000,
    Overview: "Un résumé factice, de la longueur d'un vrai, pour que la ligne ait la même allure.",
    ImageTags: { Primary: "bench" },
    UserData: {
      Played: season < CURRENT_SEASON || (season === CURRENT_SEASON && index < CURRENT_INDEX),
      PlaybackPositionTicks: current ? 5 * 60 * 10_000_000 : 0,
    },
    // La requête complète apporte les flux : c'est ce qui allume les puces.
    ...(full
      ? {
          MediaStreams: [
            { Type: "Video", Width: 1920, Height: 1080, Codec: "hevc" },
            { Type: "Audio", Language: "jpn", Codec: "aac", Channels: 2 },
            { Type: "Subtitle", Language: "fre", Codec: "ass" },
          ],
        }
      : {}),
  } as unknown as MediaItem;
}

function seasonEpisodes(seasonId: string, full: boolean): MediaItem[] {
  const season = Number(seasonId.replace("bench-season-", ""));
  const size = SEASON_SIZES[season - 1] ?? 0;
  return Array.from({ length: size }, (_, i) => makeEpisode(season, i + 1, full));
}

export const CURRENT_EPISODE = makeEpisode(CURRENT_SEASON, CURRENT_INDEX, true);

export const MOVIES = Array.from({ length: 48 }, (_, i) => ({
  Id: `bench-movie-${i + 1}`,
  Name: `Film ${i + 1}`,
  Type: "Movie",
  ProductionYear: 1980 + i,
  CommunityRating: 5 + (i % 5),
  ImageTags: { Primary: "bench" },
})) as unknown as MediaItem[];

export const GENRES = [
  "Action", "Animation", "Aventure", "Comédie", "Crime", "Documentaire",
  "Drame", "Fantastique", "Horreur", "Mystère", "Romance", "Science-fiction",
].map((name, i) => ({ Id: `bench-genre-${i + 1}`, Name: name }));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Le client : les deux requêtes de la liste d'épisodes, la légère plus vite
 * que la complète (comme sur un vrai serveur), et des images servies par le
 * relais du banc à travers le port de Metro.
 */
export function createBenchClient(): JellyfinClient {
  const client = {
    async fetch(url: string) {
      if (url.startsWith(`/Shows/${SERIES_ID}/Seasons`)) {
        await wait(120);
        return { Items: SEASONS };
      }
      const match = url.match(/\/Shows\/[^/]+\/Episodes\?SeasonId=([^&]+)/);
      if (match) {
        const full = url.includes("MediaSources");
        await wait(full ? 700 : 150);
        return { Items: seasonEpisodes(match[1], full) };
      }
      throw new Error(`banc : requête non servie ${url}`);
    },
    getImageUrl(itemId: string) {
      return `http://localhost:8081/bench/thumb.png?id=${encodeURIComponent(itemId)}`;
    },
  };
  return client as unknown as JellyfinClient;
}
