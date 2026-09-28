import { describe, expect, it } from "vitest";
import { extractMediaQuality, type MediaItem, type MediaStream } from "@tentacle-tv/shared";
import {
  keptBytes,
  localMediaItem,
  localSeriesItem,
  localStreams,
  localVersionOf,
  localVersionOfGroup,
  presetMaxHeight,
  type LocalFileFacts,
} from "./localMediaView";
import type { OfflineSeriesGroup } from "./offlineGroups";
import type { DownloadListEntry } from "../core/listing";

const video: MediaStream = {
  Type: "Video", Index: 0, IsDefault: true, Codec: "hevc", Width: 3840, Height: 1606,
  VideoRangeType: "DOVIWithHDR10", DvProfile: 8,
};
const atmos: MediaStream = {
  Type: "Audio", Index: 1, IsDefault: true, Codec: "truehd", Language: "eng", Channels: 8,
  DisplayTitle: "English - TrueHD Atmos 7.1",
};
const french: MediaStream = { Type: "Audio", Index: 2, IsDefault: false, Codec: "eac3", Language: "fre", Channels: 6 };
const textSub: MediaStream = { Type: "Subtitle", Index: 3, IsDefault: false, Codec: "subrip", Language: "fre" };
const pgs: MediaStream = { Type: "Subtitle", Index: 4, IsDefault: false, Codec: "pgssub", Language: "eng" };
const externalPgs: MediaStream = { ...pgs, Index: 5, IsExternal: true };
const streams = [video, atmos, french, textSub, pgs, externalPgs];

function file(over: Partial<LocalFileFacts> = {}): LocalFileFacts {
  return {
    itemId: "film", title: "Dune", kind: "movie", variant: "original", preset: null,
    audioStreamIndex: null, burnSubtitleIndex: null, played: false, positionTicks: 0,
    runtimeTicks: 60 * 600_000_000, seriesId: null, seriesName: null, seasonId: null,
    indexNumber: null, parentIndexNumber: null, bytesDone: 4_000_000_000, ...over,
  };
}

const snapshot: MediaItem = {
  Id: "film", Name: "Dune", Type: "Movie", RunTimeTicks: 120 * 600_000_000,
  UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: true, Played: false, Likes: true },
  MediaSources: [{
    Id: "ms", Name: "Dune", Container: "mkv", Size: 50_000_000_000,
    SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true, MediaStreams: streams,
  }],
};

describe("localStreams", () => {
  it("qualité d'origine : la source, sauf les sous-titres image externes", () => {
    expect(localStreams(streams, file()).map((s) => s.Index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("allégé : H.264 SDR au palier, une piste AAC, les sous-titres texte", () => {
    const out = localStreams(streams, file({ variant: "light", preset: "p720", audioStreamIndex: 2 }));
    expect(out.map((s) => s.Index)).toEqual([0, 2, 3]);
    expect(out[0]).toMatchObject({ Codec: "h264", Height: 720, Width: 1280, VideoRangeType: "SDR" });
    expect(out[0]?.DvProfile).toBeUndefined();
    expect(out[1]).toMatchObject({ Codec: "aac", Language: "fre", Channels: undefined });
  });

  it("allégé : la piste par défaut sans choix, et le sous-titre incrusté", () => {
    const out = localStreams(streams, file({ variant: "light", preset: "p1080", burnSubtitleIndex: 4 }));
    expect(out.map((s) => s.Index)).toEqual([0, 1, 3, 4]);
    expect(out[0]).toMatchObject({ Width: 1920, Height: 1080 });
  });

  it("copie d'image (pmax) : la vidéo telle quelle, l'audio en AAC plafonné à six canaux", () => {
    const out = localStreams(streams, file({ variant: "light", preset: "pmax" }));
    expect(out[0]).toBe(video);
    expect(out[1]).toMatchObject({ Codec: "aac", Channels: 6 });
  });

  it("ne gonfle jamais une source plus petite que le palier", () => {
    const small: MediaStream = { ...video, Width: 1280, Height: 536 };
    expect(localStreams([small], file({ variant: "light", preset: "p1080" }))[0]).toMatchObject({ Width: 1280, Height: 536 });
  });
});

describe("localMediaItem", () => {
  it("dit la qualité du FICHIER : ni 4K, ni Dolby Vision, ni Atmos pour un allégé 720p", () => {
    const quality = extractMediaQuality(localMediaItem(snapshot, file({ variant: "light", preset: "p720" })));
    expect(quality).toMatchObject({ resolution: "HD", isDolbyVision: false, isHDR: false, isDolbyAtmos: false });
    const original = extractMediaQuality(localMediaItem(snapshot, file()));
    expect(original).toMatchObject({ resolution: "4K", isDolbyVision: true, isDolbyAtmos: true });
  });

  it("porte la progression LOCALE et oublie favoris et Ma liste", () => {
    const item = localMediaItem(snapshot, file({ positionTicks: 30 * 600_000_000 }));
    expect(item.UserData).toMatchObject({ PlaybackPositionTicks: 30 * 600_000_000, Played: false, IsFavorite: false });
    expect(item.UserData?.Likes).toBeUndefined();
    expect(item.UserData?.PlayedPercentage).toBeCloseTo(25);
    expect(localMediaItem(snapshot, file({ played: true, positionTicks: 99 })).UserData).toMatchObject({ Played: true, PlaybackPositionTicks: 0 });
  });

  it("la taille réelle du fichier et son conteneur", () => {
    const light = localMediaItem(snapshot, file({ variant: "light", preset: "p480", bytesDone: 700 }));
    expect(light.MediaSources?.[0]).toMatchObject({ Container: "mp4", Size: 700 });
  });

  it("sans snapshot : ce que la base connaît", () => {
    const item = localMediaItem(null, file({
      itemId: "ep", kind: "episode", title: "Pilote", seriesId: "s", seriesName: "Lost", indexNumber: 1, parentIndexNumber: 1,
    }));
    expect(item).toMatchObject({ Id: "ep", Name: "Pilote", Type: "Episode", SeriesName: "Lost", IndexNumber: 1, RunTimeTicks: 60 * 600_000_000 });
    expect(item.MediaSources).toBeUndefined();
  });
});

describe("localSeriesItem", () => {
  const episode = (played: boolean) => ({ played } as DownloadListEntry);
  const group = (played: boolean[]): OfflineSeriesGroup => ({
    key: "s1", seriesId: "s1", seriesName: "Lost", episodeCount: played.length, posterItemId: "ep",
    seasons: [{ key: "k", seriesId: "s1", seriesName: "Lost", seasonId: "k", seasonNumber: 1, posterItemId: "ep", episodes: played.map(episode) }],
  });

  it("l'identité du groupe, sans le nombre de saisons du serveur", () => {
    const item = localSeriesItem({ Id: "x", Name: "Lost (2004)", Type: "Series", ChildCount: 6 }, group([true, false]));
    expect(item).toMatchObject({ Id: "s1", Name: "Lost", Type: "Series" });
    expect(item.ChildCount).toBeUndefined();
    expect(item.UserData?.Played).toBe(false);
  });

  it("vue quand tous les épisodes gardés le sont", () => {
    expect(localSeriesItem(null, group([true, true])).UserData?.Played).toBe(true);
  });
});

describe("versions", () => {
  it("nomme la version d'un fichier et d'un groupe", () => {
    expect(localVersionOf({ variant: "original", preset: null })).toEqual({ kind: "original" });
    expect(localVersionOf({ variant: "light", preset: "pmax" })).toEqual({ kind: "remux" });
    expect(localVersionOf({ variant: "light", preset: "p720" })).toEqual({ kind: "light", height: 720 });
    expect(localVersionOfGroup([{ variant: "light", preset: "p720" }, { variant: "light", preset: "p720" }])).toEqual({ kind: "light", height: 720 });
    expect(localVersionOfGroup([{ variant: "light", preset: "p720" }, { variant: "original", preset: null }])).toEqual({ kind: "mixed" });
    expect(localVersionOfGroup([])).toBeNull();
    expect(presetMaxHeight("p1080")).toBe(1080);
    expect(presetMaxHeight(null)).toBeNull();
  });

  it("additionne les octets gardés", () => {
    expect(keptBytes([{ bytesDone: 10 }, { bytesDone: 5 }, { bytesDone: -1 }])).toBe(15);
  });
});
