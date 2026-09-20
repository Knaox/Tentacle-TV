import { describe, expect, it } from "vitest";
import type { MediaStream } from "@tentacle-tv/shared";
import type { MpvTrack } from "../../../modules/mpv-player";
import {
  defaultTrackIndices,
  engineAudioTracks,
  externalSubtitleFormat,
  mpvAudioId,
  mpvSubtitleId,
  nativeAudioPosition,
  sameSubtitleFile,
} from "./trackMapping";

function stream(partial: Partial<MediaStream> & Pick<MediaStream, "Type" | "Codec" | "Index">): MediaStream {
  return { IsDefault: false, ...partial };
}

function track(partial: Partial<MpvTrack> & Pick<MpvTrack, "id" | "type">): MpvTrack {
  return { external: false, selected: false, default: false, forced: false, ...partial };
}

// Un MKV typique : vidéo 0, audio 1 et 2, sous-titres 3 et 4 ; un SRT externe que Jellyfin numérote 5.
const streams: MediaStream[] = [
  stream({ Type: "Video", Codec: "hevc", Index: 0 }),
  stream({ Type: "Audio", Codec: "eac3", Index: 1, IsDefault: true }),
  stream({ Type: "Audio", Codec: "aac", Index: 2 }),
  stream({ Type: "Subtitle", Codec: "ass", Index: 3 }),
  stream({ Type: "Subtitle", Codec: "pgssub", Index: 4 }),
  stream({ Type: "Subtitle", Codec: "subrip", Index: 5, IsExternal: true }),
];

const mpvTracks: MpvTrack[] = [
  track({ id: 1, type: "video", ffIndex: 0, selected: true }),
  track({ id: 1, type: "audio", ffIndex: 1, lang: "fre", title: "VF", selected: true }),
  track({ id: 2, type: "audio", ffIndex: 2, lang: "eng" }),
  track({ id: 1, type: "sub", ffIndex: 3, codec: "ass" }),
  track({ id: 2, type: "sub", ffIndex: 4, codec: "hdmv_pgs_subtitle" }),
  track({ id: 3, type: "sub", ffIndex: 0, external: true, externalFilename: "https://jf/Videos/x/ms/Subtitles/5/Stream.srt?api_key=k" }),
];

describe("trackMapping", () => {
  it("la position native d'une piste audio Jellyfin", () => {
    expect(nativeAudioPosition(streams, 1)).toBe(0);
    expect(nativeAudioPosition(streams, 2)).toBe(1);
    expect(nativeAudioPosition(streams, 9)).toBe(-1);
  });

  it("les défauts viennent de PlaybackInfo, sinon du fichier", () => {
    expect(defaultTrackIndices({ DefaultAudioStreamIndex: 2, DefaultSubtitleStreamIndex: 3, MediaStreams: streams }))
      .toEqual({ audio: 2, subtitle: 3 });
    expect(defaultTrackIndices({ MediaStreams: streams })).toEqual({ audio: 1, subtitle: -1 });
    expect(defaultTrackIndices({ MediaStreams: [] })).toEqual({ audio: -1, subtitle: -1 });
  });

  it("le format d'origine des externes : ass reste ass, le reste en srt ou vtt", () => {
    expect(externalSubtitleFormat("ass")).toBe("ass");
    expect(externalSubtitleFormat("SSA")).toBe("ass");
    expect(externalSubtitleFormat("subrip")).toBe("srt");
    expect(externalSubtitleFormat("webvtt")).toBe("vtt");
    expect(externalSubtitleFormat("mov_text")).toBe("srt");
    expect(externalSubtitleFormat(undefined)).toBe("srt");
  });

  it("l'audio se retrouve par ff-index, jamais par position", () => {
    expect(mpvAudioId(mpvTracks, 1)).toBe(1);
    expect(mpvAudioId(mpvTracks, 2)).toBe(2);
    expect(mpvAudioId(mpvTracks, 3)).toBeNull();
  });

  it("un sous-titre du fichier par ff-index, un externe par son URL, un absent = null", () => {
    const externals = [{ jellyfinIndex: 5, url: "https://jf/Videos/x/ms/Subtitles/5/Stream.srt?api_key=k", format: "srt" as const }];
    expect(mpvSubtitleId(mpvTracks, 3, externals)).toBe(1);
    expect(mpvSubtitleId(mpvTracks, 4, externals)).toBe(2);
    expect(mpvSubtitleId(mpvTracks, 5, externals)).toBe(3);
    expect(mpvSubtitleId(mpvTracks.slice(0, 5), 5, externals)).toBeNull();
    expect(mpvSubtitleId(mpvTracks, 8, externals)).toBeNull();
  });

  it("un side-car local se reconnaît en URL file:// comme en chemin", () => {
    expect(sameSubtitleFile("/var/mobile/Documents/offline/media/a/subs/5-fre.ass", "file:///var/mobile/Documents/offline/media/a/subs/5-fre.ass")).toBe(true);
    expect(sameSubtitleFile("/var/x/Un%20titre/5-fre.ass", "file:///var/x/Un titre/5-fre.ass")).toBe(true);
    expect(sameSubtitleFile("/var/x/5-fre.ass", "/var/x/6-eng.ass")).toBe(false);
  });

  it("les pistes audio annoncées à la façade portent l'index Jellyfin", () => {
    expect(engineAudioTracks(mpvTracks)).toEqual([
      { index: 1, title: "VF", language: "fre", selected: true },
      { index: 2, title: undefined, language: "eng", selected: false },
    ]);
  });
});
