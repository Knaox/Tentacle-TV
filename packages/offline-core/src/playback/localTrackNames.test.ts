import { describe, expect, it } from "vitest";
import { audioStreamsOf, matchAudioStreams, snapshotTrackLabel, subtitleModeOf, type SnapshotStream } from "./localTrackNames";

const fr: SnapshotStream = { Type: "Audio", Index: 1, Language: "fre", DisplayTitle: "Français - AAC - Stereo - Default", IsDefault: true };
const en: SnapshotStream = { Type: "Audio", Index: 2, Language: "eng", DisplayTitle: "English - TrueHD - 7.1" };
const jp: SnapshotStream = { Type: "Audio", Index: 3, Language: "jpn", DisplayTitle: "日本語 - AAC - Stereo" };
const video: SnapshotStream = { Type: "Video", Index: 0, DisplayTitle: "1080p HEVC" };
const sub: SnapshotStream = { Type: "Subtitle", Index: 4, Language: "fre", DisplayTitle: "Français - Forced", IsForced: true };
const streams = [sub, jp, video, en, fr];

describe("audioStreamsOf", () => {
  it("ne garde que l'audio, dans l'ordre du conteneur", () => {
    expect(audioStreamsOf(streams).map((s) => s.Index)).toEqual([1, 2, 3]);
  });
});

describe("matchAudioStreams", () => {
  it("un Original aux comptes égaux s'apparie par position, même si les langues divergent", () => {
    const native = [{ index: 0, language: "und" }, { index: 1, language: "und" }, { index: 2, language: "und" }];
    expect(matchAudioStreams(native, streams, { variant: "original", audioStreamIndex: null })).toEqual([fr, en, jp]);
  });

  it("un Original amputé d'une piste s'apparie par langue, chaque flux une fois", () => {
    // AVPlayer a omis le TrueHD : deux pistes natives pour trois flux.
    const native = [{ index: 0, language: "fra" }, { index: 1, language: "ja" }];
    expect(matchAudioStreams(native, streams, { variant: "original", audioStreamIndex: null })).toEqual([fr, jp]);
  });

  it("deux pistes de même langue gardent l'ordre ; une langue inconnue reste sans flux", () => {
    const fr2: SnapshotStream = { Type: "Audio", Index: 5, Language: "fre", DisplayTitle: "Français - Commentaire" };
    const native = [{ index: 0, language: "fr" }, { index: 1, language: "fr" }, { index: 2, language: "de" }];
    expect(matchAudioStreams(native, [fr, fr2, en, jp], { variant: "original", audioStreamIndex: null })).toEqual([fr, fr2, null]);
  });

  it("une variante Allégée n'a que la piste gardée par le serveur", () => {
    const native = [{ index: 0, language: "und" }];
    expect(matchAudioStreams(native, streams, { variant: "light", audioStreamIndex: 3 })).toEqual([jp]);
    // Sans index connu : la piste par défaut, sinon la première.
    expect(matchAudioStreams(native, streams, { variant: "light", audioStreamIndex: null })).toEqual([fr]);
    expect(matchAudioStreams(native, [en, jp], { variant: "light", audioStreamIndex: null })).toEqual([en]);
  });

  it("une Allégée à deux pistes natives (inattendu) suit les règles de l'Original", () => {
    const native = [{ index: 0, language: "fr" }, { index: 1, language: "en" }, { index: 2, language: "ja" }];
    expect(matchAudioStreams(native, streams, { variant: "light", audioStreamIndex: 3 })).toEqual([fr, en, jp]);
  });

  it("rend une liste de nuls sans flux ou sans piste", () => {
    expect(matchAudioStreams([{ index: 0 }], [], { variant: "original", audioStreamIndex: null })).toEqual([null]);
    expect(matchAudioStreams([], streams, { variant: "original", audioStreamIndex: null })).toEqual([]);
  });
});

describe("snapshotTrackLabel", () => {
  it("DisplayTitle tel quel, sinon Title, sinon le repli", () => {
    expect(snapshotTrackLabel(fr, () => "x")).toBe("Français - AAC - Stereo - Default");
    expect(snapshotTrackLabel({ Type: "Audio", Index: 9, Title: "Commentaire" }, () => "x")).toBe("Commentaire");
    expect(snapshotTrackLabel({ Type: "Audio", Index: 9, DisplayTitle: "  " }, () => "Piste 9")).toBe("Piste 9");
    expect(snapshotTrackLabel(null, () => "Piste 9")).toBe("Piste 9");
  });
});

describe("subtitleModeOf", () => {
  it("lit les drapeaux, pas le libellé", () => {
    expect(subtitleModeOf({ forced: true, sdh: false })).toBe("forced");
    expect(subtitleModeOf({ forced: false, sdh: true })).toBe("always");
    expect(subtitleModeOf({ forced: false, sdh: false, title: "Signs & Songs" })).toBe("signs");
    expect(subtitleModeOf({ forced: false, sdh: false, displayTitle: "English - Signs" })).toBe("signs");
    expect(subtitleModeOf({ forced: false, sdh: false, title: "Full" })).toBe("always");
  });
});
