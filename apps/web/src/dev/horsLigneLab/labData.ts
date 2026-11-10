/**
 * Les données factices du labo du hors ligne : des films libres (Blender) et des classiques du
 * domaine public — ceux du prototype —, tels que le moteur et le serveur les rendraient.
 * Les identifiants sont ceux de `bench/hors-ligne/disk.json`, qui dit quelle image sert quoi.
 */

import type { MediaItem } from "@tentacle-tv/shared";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;
const MINUTE_TICKS = 600_000_000;
const DAY = 86_400_000;
/** Une date fixe : les captures ne changent pas d'un jour à l'autre. */
const NOW = Date.UTC(2026, 10, 10, 12);

const stream = (type: "Video" | "Audio" | "Subtitle", index: number, extra: Record<string, unknown>) => ({ Type: type, Index: index, ...extra });

function sources(sizeBytes: number, height: number): MediaItem["MediaSources"] {
  return [{
    Id: "src", Container: "mkv", Size: sizeBytes, Bitrate: 12_000_000,
    MediaStreams: [
      stream("Video", 0, { Codec: "hevc", Height: height, Width: Math.round((height * 16) / 9), DisplayTitle: `${height}p HEVC`, VideoRange: "SDR" }),
      stream("Audio", 1, { Codec: "eac3", Language: "fre", DisplayTitle: "Français — Dolby Digital+ 5.1", Channels: 6, IsDefault: true }),
      stream("Audio", 2, { Codec: "aac", Language: "eng", DisplayTitle: "Anglais — AAC stéréo", Channels: 2 }),
      stream("Subtitle", 3, { Codec: "subrip", Language: "fre", DisplayTitle: "Français", IsTextSubtitleStream: true }),
      stream("Subtitle", 4, { Codec: "pgssub", Language: "fre", DisplayTitle: "Français (forcés, image)", IsTextSubtitleStream: false }),
    ],
  }] as unknown as MediaItem["MediaSources"];
}

interface MovieSeed { id: string; title: string; year: number; minutes: number; rating: number; gib: number; overview: string; genres: string[] }

const MOVIE_SEEDS: MovieSeed[] = [
  { id: "sintel", title: "Sintel", year: 2010, minutes: 15, rating: 7.4, gib: 2.4, genres: ["Fantastique", "Animation"], overview: "Une jeune femme parcourt des terres hostiles à la recherche du dragon qu'elle a recueilli enfant." },
  { id: "tos", title: "Tears of Steel", year: 2012, minutes: 12, rating: 6.6, gib: 1.9, genres: ["Science-fiction"], overview: "À Amsterdam, une poignée de scientifiques tente de sauver le monde des robots en rejouant une rupture amoureuse." },
  { id: "spring", title: "Spring", year: 2019, minutes: 8, rating: 7.5, gib: 1.1, genres: ["Fantastique", "Animation"], overview: "Une bergère et son chien affrontent d'anciens esprits pour que le printemps revienne dans la vallée." },
  { id: "bbb", title: "Big Buck Bunny", year: 2008, minutes: 10, rating: 6.5, gib: 0.9, genres: ["Comédie", "Animation"], overview: "Un lapin géant et placide décide de se venger de trois rongeurs qui lui gâchent la vie." },
  { id: "vertigo", title: "Sueurs froides", year: 1958, minutes: 128, rating: 8.3, gib: 14.2, genres: ["Thriller"], overview: "Un ancien policier sujet au vertige est chargé de suivre une femme que le passé semble posséder." },
  { id: "charade", title: "Charade", year: 1963, minutes: 113, rating: 7.9, gib: 9.6, genres: ["Comédie policière"], overview: "À Paris, une jeune veuve découvre que trois hommes cherchent la fortune que son mari a volée." },
];

export function movieItem(seed: MovieSeed): MediaItem {
  return {
    Id: seed.id, Name: seed.title, Type: "Movie", ProductionYear: seed.year, CommunityRating: seed.rating,
    RunTimeTicks: seed.minutes * MINUTE_TICKS, Overview: seed.overview, Genres: seed.genres,
    MediaSources: sources(seed.gib * GIB, 2160),
  } as unknown as MediaItem;
}

export const LAB_MOVIES = MOVIE_SEEDS.map(movieItem);
export const LAB_MOVIE = LAB_MOVIES[4] as MediaItem; // Sueurs froides : un vrai long métrage, 14 Gio

const EPISODE_NAMES = ["Llama Drama", "Gran Dillama", "Llamigos", "La Clôture", "Le Manchot", "Patagonie", "La Route", "Les Baies"];
const EPISODE_MIB = [148, 212, 164, 236, 188, 204, 176, 252];

/** Une série : `seasons[n]` épisodes dans la saison n + 1. */
function episodesOf(seriesId: string, seriesName: string, seasons: number[], prefix: string): MediaItem[] {
  const out: MediaItem[] = [];
  seasons.forEach((count, seasonIndex) => {
    for (let n = 1; n <= count; n += 1) {
      const flat = out.length;
      out.push({
        Id: `${prefix}-s${seasonIndex + 1}e${n}`, Name: EPISODE_NAMES[flat % EPISODE_NAMES.length], Type: "Episode",
        SeriesId: seriesId, SeriesName: seriesName, SeasonId: `${seriesId}-s${seasonIndex + 1}`,
        ParentIndexNumber: seasonIndex + 1, IndexNumber: n, RunTimeTicks: (2 + (flat % 3)) * MINUTE_TICKS, CommunityRating: 7.7,
        Overview: "Koro veut traverser la route. La route n'est pas d'accord.",
        MediaSources: sources((EPISODE_MIB[flat % EPISODE_MIB.length] as number) * MIB, 1080),
      } as unknown as MediaItem);
    }
  });
  return out;
}

/** « Caminandes » : la saison de 8 épisodes que l'on met en file, et trois saisons pour la feuille de série. */
export const LAB_SEASON = episodesOf("cam", "Caminandes", [8], "cam");
export const LAB_SERIES_EPISODES = episodesOf("cam", "Caminandes", [8, 6, 4], "camx");
/** « Sprite Fright » : la série déjà sur la machine (deux saisons, la reprise à S1 · E3). */
const KEPT_SERIES = episodesOf("sprite", "Sprite Fright", [5, 3], "spr");

export const LAB_SERIES_ITEM = {
  Id: "sprite", Name: "Sprite Fright", Type: "Series", ProductionYear: 2021, CommunityRating: 6.8, Genres: ["Horreur", "Comédie"],
  Overview: "Des adolescents en randonnée dérangent un peuple de petits champignons bien moins inoffensifs qu'ils n'en ont l'air.",
} as unknown as MediaItem;

interface EntryOptions {
  /** L'identifiant du fichier : STABLE d'un état à l'autre — le lot de la file retient ses membres. */
  id: number;
  status?: DownloadListEntry["status"];
  bytesDone?: number;
  played?: boolean;
  /** Avancement de la lecture, 0..1. */
  watchedRatio?: number;
  errorCode?: string | null;
  pausedByUser?: boolean;
  variant?: "original" | "light";
  ageDays?: number;
  nextRetryAt?: number | null;
  /** La phase d'un transfert (`prepare` : le serveur prépare encore le fichier). */
  phase?: string;
}

/** L'entrée de liste qu'un titre aurait dans la base du moteur. */
export function entryOf(item: MediaItem, options: EntryOptions): DownloadListEntry {
  const size = (item.MediaSources?.[0] as { Size?: number } | undefined)?.Size ?? 0;
  const light = options.variant === "light";
  const expected = light ? Math.round(size * 0.24) : size;
  const status = options.status ?? "complete";
  const episode = item.Type === "Episode";
  const runtime = item.RunTimeTicks ?? 0;
  return {
    id: options.id, itemId: item.Id, mediaSourceId: "src", variant: light ? "light" : "original", preset: light ? "p720" : null,
    relPath: `media/${item.Id}.mkv`, expectedSize: expected, bytesDone: status === "complete" ? expected : (options.bytesDone ?? 0),
    status, errorCode: options.errorCode ?? null, audioStreamIndex: null, burnSubtitleIndex: null, retryCount: 0, lastErrorAt: null,
    nextRetryAt: options.nextRetryAt ?? null, phase: status === "downloading" ? (options.phase ?? "transfer") : null, subtitlesDone: status === "complete" ? 1 : 0, sourcePath: null,
    title: item.Name ?? item.Id, seriesName: episode ? (item.SeriesName ?? null) : null, kind: episode ? "episode" : "movie",
    seriesId: episode ? (item.SeriesId ?? null) : null, seasonId: episode ? (item.SeasonId ?? null) : null,
    libraryId: episode ? "lib-series" : "lib-films", libraryName: episode ? "Séries" : "Films", libraryType: episode ? "tvshows" : "movies",
    indexNumber: item.IndexNumber ?? null, parentIndexNumber: item.ParentIndexNumber ?? null, runtimeTicks: runtime || null,
    autoDeleteAfterWatch: false, autoDeleteDelayMinutes: 0, deleteScheduledAt: null,
    played: options.played ?? false, positionTicks: Math.round(runtime * (options.watchedRatio ?? 0)),
    createdAt: NOW - (options.ageDays ?? 3) * DAY, lastPlayedAt: options.watchedRatio || options.played ? NOW - DAY : null,
    pausedByUser: options.pausedByUser ?? false, subtitlesExpected: 1,
  } as unknown as DownloadListEntry;
}

/** Ce que la machine garde déjà : six films (un entamé, un vu) et « Sprite Fright », reprise à S1 · E3. */
export function keptLibrary(): DownloadListEntry[] {
  const movies = LAB_MOVIES.map((item, index) =>
    entryOf(item, { id: 9001 + index, ageDays: index + 1, watchedRatio: item.Id === "bbb" ? 0.45 : 0, played: item.Id === "charade", variant: item.Id === "tos" ? "light" : "original" }),
  );
  const episodes = KEPT_SERIES.map((item, index) =>
    entryOf(item, { id: 9020 + index, ageDays: 9, played: index < 2, watchedRatio: index === 2 ? 0.4 : 0 }),
  );
  return [...movies, ...episodes];
}

/** Les instantanés du disque (`item.json`, `series.json`) de tout ce que le labo peut garder. */
export function labSnapshots(): Record<string, { item?: MediaItem; series?: MediaItem }> {
  const out: Record<string, { item?: MediaItem; series?: MediaItem }> = {};
  for (const item of LAB_MOVIES) out[item.Id] = { item };
  for (const item of KEPT_SERIES) out[item.Id] = { item, series: LAB_SERIES_ITEM };
  for (const item of LAB_SEASON) out[item.Id] = { item };
  return out;
}

export const LAB_KEPT_SERIES_KEY = "sprite";
export const LAB_GIB = GIB;
