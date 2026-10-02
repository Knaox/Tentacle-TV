import { describe, expect, it } from "vitest";
import type { MediaItem, MediaStream } from "../types/media";
import {
  NO_QUALITY_BADGES,
  defaultMediaStreams,
  fitQualityBadges,
  qualityBadgesOf,
  qualityBadgesOfStreams,
  type QualityBadge,
} from "./qualityBadges";

const video = (Width: number, Height: number, extra: Partial<MediaStream> = {}): MediaStream =>
  ({ Type: "Video", Codec: "hevc", Index: 0, IsDefault: true, Width, Height, ...extra }) as MediaStream;
const audio = (extra: Partial<MediaStream> = {}): MediaStream =>
  ({ Type: "Audio", Codec: "eac3", Index: 1, IsDefault: false, ...extra }) as MediaStream;
const labels = (badges: readonly QualityBadge[] | undefined) => badges?.map((b) => b.label);
const shorts = (badges: readonly QualityBadge[] | undefined) => badges?.map((b) => b.short);

describe("qualityBadgesOfStreams", () => {
  it("4K, Dolby Vision, Dolby Atmos : dans cet ordre, l'Atmos sur la VO et pas sur la piste par défaut", () => {
    // Captain America : Brave New World (instantané Knaoxtest) — VFF DD+ par défaut, VO TrueHD Atmos.
    const streams = [
      video(3840, 1608, { VideoRangeType: "DOVIWithHDR10", DvProfile: 8 }),
      audio({ IsDefault: true, DisplayTitle: "FR VFF : DDP 7.1 - French - Dolby Digital+ - Par défaut" }),
      audio({ Codec: "truehd", Profile: "Dolby TrueHD + Dolby Atmos", DisplayTitle: "ENG VO : TrueHD 7.1 Atmos - English - Dolby TrueHD + Dolby Atmos" }),
    ];
    const badges = qualityBadgesOfStreams(streams);
    expect(labels(badges)).toEqual(["4K", "Dolby Vision", "Dolby Atmos"]);
    expect(shorts(badges)).toEqual(["4K", "VISION", "ATMOS"]);
    expect(badges.map((b) => b.accent)).toEqual([true, false, false]);
  });

  it("un 1080p SDR en Dolby Digital : rien", () => {
    const badges = qualityBadgesOfStreams([video(1920, 816, { VideoRangeType: "SDR" }), audio({ Codec: "ac3", IsDefault: true })]);
    expect(badges).toBe(NO_QUALITY_BADGES);
  });

  it("un épisode 4K HDR10 sans Atmos", () => {
    expect(labels(qualityBadgesOfStreams([video(3840, 2160, { VideoRangeType: "HDR10" }), audio({ Codec: "ac3" })]))).toEqual(["4K", "HDR10"]);
  });

  it("un 4K recadré (scope) reste un 4K ; un 1440p n'en est pas un", () => {
    expect(labels(qualityBadgesOfStreams([video(3832, 1600)]))).toEqual(["4K"]);
    expect(labels(qualityBadgesOfStreams([video(3248, 2160)]))).toEqual(["4K"]);
    expect(qualityBadgesOfStreams([video(2560, 1440)])).toEqual([]);
  });

  it("une seule plage : Dolby Vision l'emporte, puis HDR10+, HDR10, HDR", () => {
    const range = (VideoRangeType: string, extra: Partial<MediaStream> = {}) =>
      labels(qualityBadgesOfStreams([video(1920, 1080, { VideoRangeType, ...extra })]));
    expect(range("DOVIWithHDR10Plus")).toEqual(["Dolby Vision"]);
    expect(range("DOVIWithSDR")).toEqual(["Dolby Vision"]);
    expect(range("DOVI")).toEqual(["Dolby Vision"]);
    expect(range("HDR10Plus")).toEqual(["HDR10+"]);
    expect(range("HDR10", { Hdr10PlusPresentFlag: true })).toEqual(["HDR10+"]);
    expect(range("HDR10")).toEqual(["HDR10"]);
    expect(range("HLG")).toEqual(["HDR"]);
    expect(range("SDR")).toEqual([]);
    expect(range("Unknown")).toEqual([]);
  });

  it("« DOVIInvalid » n'est pas du Dolby Vision : HDR", () => {
    expect(labels(qualityBadgesOfStreams([video(1920, 1080, { VideoRangeType: "DOVIInvalid", DvProfile: 5 })]))).toEqual(["HDR"]);
  });

  it("plage en entier (index d'énumération) : le profil Dolby Vision et le drapeau HDR10+ parlent, rien n'est deviné", () => {
    expect(labels(qualityBadgesOfStreams([video(1920, 1080, { VideoRangeType: 5, DvProfile: 8 })]))).toEqual(["Dolby Vision"]);
    expect(labels(qualityBadgesOfStreams([video(1920, 1080, { VideoRangeType: 12, Hdr10PlusPresentFlag: true })]))).toEqual(["HDR10+"]);
    expect(qualityBadgesOfStreams([video(1920, 1080, { VideoRangeType: 2 })])).toEqual([]);
  });

  it("l'Atmos se lit au profil ou au titre, jamais au codec seul", () => {
    expect(labels(qualityBadgesOfStreams([audio({ Codec: "truehd" })]))).toEqual([]);
    expect(labels(qualityBadgesOfStreams([audio({ Profile: "Dolby Digital Plus + Dolby Atmos" })]))).toEqual(["Dolby Atmos"]);
    expect(labels(qualityBadgesOfStreams([audio({ DisplayTitle: "VO Atmos 7.1 - English" })]))).toEqual(["Dolby Atmos"]);
    // Un mot qui contient « atmos » n'est pas l'Atmos.
    expect(labels(qualityBadgesOfStreams([audio({ DisplayTitle: "Atmosphère - Français" })]))).toEqual([]);
    // Un sous-titre qui en parle non plus.
    expect(labels(qualityBadgesOfStreams([{ ...audio({ DisplayTitle: "Atmos" }), Type: "Subtitle" }]))).toEqual([]);
  });

  it("même qualité, même tableau : une carte mémoïsée ne bouge pas", () => {
    const a = qualityBadgesOfStreams([video(3840, 2160, { VideoRangeType: "HDR10" })]);
    const b = qualityBadgesOfStreams([video(3840, 1600, { VideoRangeType: "HDR10" }), audio()]);
    expect(a).toBe(b);
  });
});

describe("qualityBadgesOf", () => {
  const item = (extra: Partial<MediaItem>): MediaItem => ({ Id: "x", Name: "x", Type: "Movie", ...extra }) as MediaItem;

  it("sans ses flux, l'item ne dit rien : à lire à la demande", () => {
    expect(qualityBadgesOf(item({}))).toBeUndefined();
    expect(qualityBadgesOf(undefined)).toBeUndefined();
    expect(defaultMediaStreams(item({ Type: "Series" }))).toBeUndefined();
  });

  it("la source par défaut d'abord, sinon les flux seuls (Fields=MediaStreams)", () => {
    const uhd = [video(3840, 2160)];
    const hd = [video(1920, 1080)];
    const source = (MediaStreams: MediaStream[]) => ({ Id: "s", Name: "s", Container: "mkv", SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true, MediaStreams });
    expect(labels(qualityBadgesOf(item({ MediaStreams: uhd })))).toEqual(["4K"]);
    expect(labels(qualityBadgesOf(item({ MediaSources: [source(hd), source(uhd)], MediaStreams: uhd })))).toEqual([]);
  });

  it("une source sans flux : connue, et vide", () => {
    expect(qualityBadgesOf(item({ MediaSources: [{ Id: "s", Name: "s", Container: "mkv", SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true, MediaStreams: [] }] }))).toBe(NO_QUALITY_BADGES);
  });
});

describe("fitQualityBadges", () => {
  const all = qualityBadgesOfStreams([
    video(3840, 2160, { VideoRangeType: "DOVIWithHDR10" }),
    audio({ Profile: "Dolby TrueHD + Dolby Atmos" }),
  ]);
  // Une largeur par badge (sa forme courte × 10), sans marge.
  const widthOf = (badges: readonly QualityBadge[]) => badges.reduce((sum, b) => sum + b.short.length * 10, 0);

  it("tout tient : la liste telle quelle", () => {
    expect(fitQualityBadges(all, 200, widthOf)).toBe(all);
  });

  it("ce qui tient, dans l'ordre : le 4K d'abord", () => {
    expect(shorts(fitQualityBadges(all, 100, widthOf))).toEqual(["4K", "VISION"]);
    expect(shorts(fitQualityBadges(all, 30, widthOf))).toEqual(["4K"]);
  });

  it("rien ne tient : la liste vide", () => {
    expect(fitQualityBadges(all, 10, widthOf)).toBe(NO_QUALITY_BADGES);
    expect(fitQualityBadges(NO_QUALITY_BADGES, 500, widthOf)).toBe(NO_QUALITY_BADGES);
  });
});
