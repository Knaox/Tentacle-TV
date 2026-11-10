/**
 * Les titres du labo, à la forme que Jellyfin leur donne (`BaseItemDto`) : ce que les VRAIS
 * crochets d'`api-client` lisent. Rien d'un vrai serveur.
 */

import type { MediaItem } from "@tentacle-tv/shared";
import {
  LAB_COLLECTION_ID, LAB_COLLECTION_NAME, LAB_COLLECTION_TITLES, LAB_EPISODES, LAB_SERIES_ID, LAB_STUDIO, LAB_TITLES, LAB_TONES,
  type LabEpisode, type LabTitle,
} from "./labData";

const TICKS_PER_MINUTE = 600_000_000;
const slug = (text: string): string => text.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const genreId = (name: string): string => `g-${slug(name)}`;
export const personId = (name: string): string => `p-${slug(name)}`;
const studioId = (name: string): string => `s-${slug(name)}`;

/** Quelle image du banc sert chaque (titre, type) — lu par `LabClient.getImageUrl`. */
export const LAB_ART = new Map<string, string>();
const art = (id: string, type: string, file: string): string => {
  LAB_ART.set(`${id}/${type}`, file);
  return file;
};
const hashes = (pairs: Array<[string, string | undefined]>): Record<string, Record<string, string>> => {
  const out: Record<string, Record<string, string>> = {};
  for (const [type, file] of pairs) if (file && LAB_TONES[file]) out[type] = { [file]: `${LAB_TONES[file]}00000000000000000000` };
  return out;
};

/** Ma liste : les titres « aimés » au sens de Jellyfin (`UserData.Likes`). */
const LISTED = new Set(["charade", "spring", "tos", "third", "cam", "rashomon", "sprite"]);

function userData(progress: number | undefined, played: boolean | undefined, favorite: boolean | undefined, minutes: number, id = "") {
  return {
    Likes: LISTED.has(id) ? true : undefined,
    Played: played === true,
    IsFavorite: favorite === true,
    PlaybackPositionTicks: progress ? Math.round(progress * minutes * TICKS_PER_MINUTE) : 0,
    PlayedPercentage: progress ? progress * 100 : played ? 100 : 0,
    PlayCount: played ? 1 : 0,
  };
}

function streams(title: Pick<LabTitle, "width" | "hdr" | "audio" | "subs">) {
  const video = {
    Type: "Video", Index: 0, Codec: title.width === 3840 ? "hevc" : "h264", Width: title.width, Height: title.width === 3840 ? 2160 : 1080,
    VideoRangeType: title.hdr ? "HDR10" : "SDR", VideoRange: title.hdr ? "HDR" : "SDR", BitRate: title.width === 3840 ? 42_000_000 : 9_000_000,
    DisplayTitle: title.width === 3840 ? "4K HEVC" : "1080p H.264",
  };
  const audio = title.audio.map((lang, i) => ({
    Type: "Audio", Index: 1 + i, Codec: i === 0 && title.hdr ? "truehd" : "eac3", Channels: 6, Language: lang, IsDefault: i === 0,
    Profile: i === 0 && title.hdr ? "Dolby TrueHD + Dolby Atmos" : undefined, DisplayTitle: `${lang.toUpperCase()} 5.1`,
  }));
  const subs = title.subs.map((lang, i) => ({ Type: "Subtitle", Index: 10 + i, Codec: "subrip", Language: lang, DisplayTitle: lang.toUpperCase() }));
  return [video, ...audio, ...subs];
}

function people(title: LabTitle) {
  const cast = (title.cast ?? []).map((name, i) => ({ Name: name, Id: personId(name), Type: "Actor", Role: i === 0 ? "Rôle principal" : "Second rôle" }));
  return title.director ? [...cast, { Name: title.director, Id: personId(title.director), Type: "Director", Role: "Réalisation" }] : cast;
}

function toItem(title: LabTitle): MediaItem {
  const ownStudio = LAB_COLLECTION_TITLES.includes(title.id) || title.id === LAB_SERIES_ID;
  const media = streams(title);
  const item = {
    Id: title.id,
    Name: title.name,
    Type: title.series ? "Series" : "Movie",
    ParentId: title.series ? "series" : "films",
    ProductionYear: title.year,
    PremiereDate: `${title.year}-06-01T00:00:00.000Z`,
    DateCreated: `${title.added}T12:00:00.000Z`,
    Genres: title.genres,
    GenreItems: title.genres.map((name) => ({ Name: name, Id: genreId(name) })),
    CommunityRating: title.rating,
    OfficialRating: title.genres.includes("Horreur") ? "16+" : "Tous publics",
    RunTimeTicks: title.minutes * TICKS_PER_MINUTE,
    Overview: title.overview,
    ImageTags: { Primary: art(title.id, "Primary", title.poster) },
    BackdropImageTags: title.backdrop ? [art(title.id, "Backdrop", title.backdrop)] : [],
    ImageBlurHashes: hashes([["Primary", title.poster], ["Backdrop", title.backdrop]]),
    PrimaryImageAspectRatio: title.poster.startsWith("b-") ? 1.78 : 0.667,
    UserData: userData(title.progress, title.played, title.favorite, title.minutes, title.id),
    Studios: ownStudio ? [{ Name: LAB_STUDIO, Id: studioId(LAB_STUDIO) }] : [],
    People: people(title),
    ProviderIds: {},
    // Une bande-annonce distante : le bouton « Bande-annonce » de la fiche paraît.
    RemoteTrailers: title.backdrop ? [{ Url: "https://www.youtube.com/watch?v=eRsGyueVLvQ", Name: "Bande-annonce" }] : [],
    RecursiveItemCount: title.series ? LAB_EPISODES.length : 0,
    ChildCount: title.series ? 2 : undefined,
    Status: title.series ? "Ended" : undefined,
    MediaSources: title.series ? [] : [{ Id: title.id, Container: "mkv", Size: title.minutes * 60 * 5_000_000, MediaStreams: media }],
    MediaStreams: title.series ? [] : media,
  };
  return item as unknown as MediaItem;
}

function seasonId(season: number): string {
  return `${LAB_SERIES_ID}-s${season}`;
}

function toEpisode(episode: LabEpisode): MediaItem {
  const series = LAB_TITLES.find((title) => title.id === LAB_SERIES_ID)!;
  const media = streams(series);
  const item = {
    Id: episode.id,
    Name: episode.name,
    Type: "Episode",
    SeriesId: LAB_SERIES_ID,
    SeriesName: series.name,
    SeasonId: seasonId(episode.season),
    SeasonName: episode.season === 0 ? "Spéciaux" : `Saison ${episode.season}`,
    ParentIndexNumber: episode.season,
    IndexNumber: episode.index,
    ProductionYear: series.year,
    PremiereDate: `${series.year}-0${episode.index}-10T00:00:00.000Z`,
    RunTimeTicks: episode.minutes * TICKS_PER_MINUTE,
    Overview: episode.overview,
    CommunityRating: 7.2 + episode.index / 10,
    ImageTags: { Primary: art(episode.id, "Primary", episode.still) },
    ParentBackdropItemId: LAB_SERIES_ID,
    ParentBackdropImageTags: [series.backdrop],
    SeriesPrimaryImageTag: series.poster,
    ImageBlurHashes: hashes([["Primary", episode.still]]),
    UserData: userData(episode.progress, episode.played, false, episode.minutes),
    MediaSources: [{ Id: episode.id, Container: "mkv", Size: episode.minutes * 60 * 3_000_000, MediaStreams: media }],
    MediaStreams: media,
    Genres: series.genres,
  };
  return item as unknown as MediaItem;
}

function toSeason(season: number): MediaItem {
  const episodes = LAB_EPISODES.filter((episode) => episode.season === season);
  const item = {
    Id: seasonId(season),
    Name: season === 0 ? "Spéciaux" : `Saison ${season}`,
    Type: "Season",
    SeriesId: LAB_SERIES_ID,
    IndexNumber: season,
    ChildCount: episodes.length,
    ImageTags: { Primary: art(seasonId(season), "Primary", "b-cam2") },
    UserData: { Played: episodes.every((e) => e.played), UnplayedItemCount: episodes.filter((e) => !e.played).length, IsFavorite: false, PlaybackPositionTicks: 0 },
  };
  return item as unknown as MediaItem;
}

function toCollection(): MediaItem {
  const first = LAB_TITLES.find((title) => title.id === LAB_COLLECTION_TITLES[0])!;
  const item = {
    Id: LAB_COLLECTION_ID,
    Name: LAB_COLLECTION_NAME,
    Type: "BoxSet",
    Overview: "Les courts métrages libres du studio Blender, de Big Buck Bunny à Charge : chacun a servi à éprouver une version du logiciel, et tous sont diffusés sous licence Creative Commons.",
    ProductionYear: 2008,
    Genres: ["Animation"],
    ChildCount: LAB_COLLECTION_TITLES.length,
    ImageTags: { Primary: art(LAB_COLLECTION_ID, "Primary", first.poster) },
    BackdropImageTags: [art(LAB_COLLECTION_ID, "Backdrop", "b-spring")],
    ImageBlurHashes: hashes([["Primary", first.poster], ["Backdrop", "b-spring"]]),
    UserData: { Played: false, IsFavorite: false, PlaybackPositionTicks: 0 },
    People: [],
    ProviderIds: {},
  };
  return item as unknown as MediaItem;
}

export const LAB_ITEMS: MediaItem[] = LAB_TITLES.map(toItem);
export const LAB_EPISODE_ITEMS: MediaItem[] = LAB_EPISODES.map(toEpisode);
export const LAB_SEASONS: MediaItem[] = [toSeason(1), toSeason(0)];
export const LAB_COLLECTION: MediaItem = toCollection();

const byId = new Map<string, MediaItem>(
  [...LAB_ITEMS, ...LAB_EPISODE_ITEMS, ...LAB_SEASONS, LAB_COLLECTION].map((item) => [item.Id, item]),
);

export function labItem(id: string): MediaItem | undefined {
  return byId.get(id);
}

/** Les genres d'une bibliothèque (ou de toutes), triés — `/Genres`. */
export function labGenres(libraryId?: string): Array<{ Id: string; Name: string }> {
  const names = new Set<string>();
  for (const item of LAB_ITEMS) if (!libraryId || item.ParentId === libraryId) for (const genre of item.Genres ?? []) names.add(genre);
  return [...names].sort((a, b) => a.localeCompare(b, "fr")).map((name) => ({ Id: genreId(name), Name: name }));
}

/** Une personne et sa filmographie — la page Personne. */
export function labPerson(id: string): { person: MediaItem; credits: MediaItem[] } | null {
  const credits = LAB_ITEMS.filter((item) => item.People?.some((p) => p.Id === id));
  const entry = credits[0]?.People?.find((p) => p.Id === id);
  if (!entry) return null;
  const person = {
    Id: id,
    Name: entry.Name,
    Type: "Person",
    Overview: `${entry.Name} a tourné ${credits.length} des titres de cette bibliothèque de démonstration. Sa biographie complète vient de Jellyfin sur un vrai serveur ; ce texte tient sa place et sa longueur, pour juger la mise en page d'un paragraphe de quelques lignes.`,
    PremiereDate: "1904-01-18T00:00:00.000Z",
    ProductionLocations: ["Bristol, Royaume-Uni"],
    ImageTags: {},
    UserData: { IsFavorite: false, Played: false, PlaybackPositionTicks: 0 },
  };
  return { person: person as unknown as MediaItem, credits };
}
