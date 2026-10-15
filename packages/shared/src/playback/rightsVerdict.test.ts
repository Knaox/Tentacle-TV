import { describe, expect, it } from "vitest";
import type { MediaSource } from "../types/media";
import { FULL_PLAYBACK_RIGHTS, type PlaybackRights } from "./playbackRights";
import { builtUrlRefusal, negotiatedRefusal, rightsBitrate, upfrontRefusal } from "./rightsVerdict";

const rights = (patch: Partial<PlaybackRights>): PlaybackRights => ({ ...FULL_PLAYBACK_RIGHTS, ...patch });
/** Les fichiers du banc : MPEG-2 en MKV, AC3 5.1 en MKV, H.264 à 8 Mb/s. */
const mpeg2 = {
  Bitrate: 2_200_000,
  MediaStreams: [{ Type: "Video", Index: 0, Codec: "mpeg2video", Width: 640, Height: 360 }, { Type: "Audio", Index: 1, Codec: "aac", Channels: 2 }],
} as unknown as MediaSource;
const ac3 = {
  MediaStreams: [{ Type: "Video", Index: 0, Codec: "h264" }, { Type: "Audio", Index: 1, Codec: "ac3", Channels: 6 }],
  DefaultAudioStreamIndex: 1,
} as unknown as MediaSource;
const heavy = { Bitrate: 8_200_000, MediaStreams: [{ Type: "Video", Codec: "h264", Height: 720, BitRate: 8_000_000 }] } as unknown as MediaSource;
const jellyfinUrl = "/videos/abc/master.m3u8?MediaSourceId=abc&VideoCodec=h264&AudioCodec=aac&TranscodingMaxAudioChannels=2&TranscodeReasons=ContainerNotSupported";

describe("negotiatedRefusal — ce que Jellyfin propose au lecteur web", () => {
  it("la lecture interdite refuse même le fichier tel quel", () => {
    expect(negotiatedRefusal(rights({ mediaPlayback: false }), mpeg2, true, null)).toBe("playback_not_allowed");
  });
  it("le fichier tel quel ne demande aucun droit de conversion", () => {
    expect(negotiatedRefusal(rights({ videoTranscoding: false, audioTranscoding: false, remuxing: false }), mpeg2, true, null)).toBeNull();
  });
  it("chaque conversion de la TranscodingUrl demande son droit", () => {
    expect(negotiatedRefusal(rights({ videoTranscoding: false }), mpeg2, false, jellyfinUrl)).toBe("conversion_not_allowed");
    expect(negotiatedRefusal(rights({ audioTranscoding: false }), ac3, false, jellyfinUrl)).toBe("conversion_not_allowed");
    expect(negotiatedRefusal(rights({ audioTranscoding: false }), mpeg2, false, jellyfinUrl)).toBeNull();
  });
  it("rien de jouable alors qu'une conversion est refusée : c'est elle qui manque", () => {
    expect(negotiatedRefusal(rights({ remuxing: false, videoTranscoding: false, audioTranscoding: false }), mpeg2, false, null)).toBe("conversion_not_allowed");
    expect(negotiatedRefusal(FULL_PLAYBACK_RIGHTS, mpeg2, false, null)).toBeNull();
    expect(negotiatedRefusal(undefined, mpeg2, false, jellyfinUrl)).toBeNull();
  });
});

describe("rightsBitrate — le débit demandé à PlaybackInfo", () => {
  it("borne le palier au plafond ; « Originale » prend le plafond seul", () => {
    expect(rightsBitrate(8_000_000, rights({ maxBitrate: 2_000_000 }))).toBe(2_000_000);
    expect(rightsBitrate(1_000_000, rights({ maxBitrate: 2_000_000 }))).toBe(1_000_000);
    expect(rightsBitrate(undefined, rights({ maxBitrate: 2_000_000 }))).toBe(2_000_000);
    expect(rightsBitrate(undefined, FULL_PLAYBACK_RIGHTS)).toBeUndefined();
  });
});

describe("builtUrlRefusal — l'URL que mpv fabrique", () => {
  const base = "https://tentacle.test/api/jellyfin";
  it("le fichier tel quel passe, sauf lecture interdite ou plafond sans droit de réencoder", () => {
    expect(builtUrlRefusal(rights({ videoTranscoding: false }), `${base}/Videos/abc/stream?Static=true`, mpeg2)).toBeNull();
    expect(builtUrlRefusal(rights({ mediaPlayback: false }), `${base}/Videos/abc/stream?Static=true`, mpeg2)).toBe("playback_not_allowed");
    expect(builtUrlRefusal(rights({ maxBitrate: 2_000_000, videoTranscoding: false }), `${base}/Videos/abc/stream?Static=true`, heavy))
      .toBe("conversion_not_allowed");
    expect(builtUrlRefusal(rights({ maxBitrate: 2_000_000 }), `${base}/Videos/abc/stream?Static=true`, heavy)).toBeNull();
  });
  it("un palier réencode l'image : refusé sans le droit", () => {
    const tier = `${base}/Videos/abc/master.m3u8?VideoCodec=hevc,h264&AudioCodec=aac&AllowVideoStreamCopy=false&VideoBitrate=1800000`;
    expect(builtUrlRefusal(rights({ videoTranscoding: false }), tier, heavy)).toBe("conversion_not_allowed");
    expect(builtUrlRefusal(FULL_PLAYBACK_RIGHTS, tier, heavy)).toBeNull();
  });
});

describe("upfrontRefusal — ce que la fiche suffit à trancher", () => {
  it("la lecture interdite, ou le plafond sans droit de réencoder", () => {
    expect(upfrontRefusal(rights({ mediaPlayback: false }), mpeg2)).toBe("playback_not_allowed");
    expect(upfrontRefusal(rights({ maxBitrate: 2_000_000, videoTranscoding: false }), heavy)).toBe("conversion_not_allowed");
    expect(upfrontRefusal(rights({ maxBitrate: 2_000_000 }), heavy)).toBeNull();
    expect(upfrontRefusal(rights({ videoTranscoding: false }), heavy)).toBeNull();
  });
});
