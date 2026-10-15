import { describe, expect, it } from "vitest";
import {
  FULL_PLAYBACK_RIGHTS,
  NO_CONVERSION,
  playbackRefusal,
  streamConversions,
  type ConversionSource,
  type PlaybackRights,
} from "./playbackRights";

/** Les fichiers du banc (Jellyfin jetable) : H.264/AAC en MKV, MPEG-2, AC3 5.1. */
const h264Mkv: ConversionSource = {
  MediaStreams: [
    { Type: "Video", Index: 0, Codec: "h264", Width: 640, Height: 360, BitRate: 600_000 },
    { Type: "Audio", Index: 1, Codec: "aac", Channels: 2, BitRate: 128_000 },
  ],
  DefaultAudioStreamIndex: 1,
};
const mpeg2: ConversionSource = {
  MediaStreams: [
    { Type: "Video", Index: 0, Codec: "mpeg2video", Width: 640, Height: 360, BitRate: 2_000_000 },
    { Type: "Audio", Index: 1, Codec: "aac", Channels: 2, BitRate: 128_000 },
  ],
};
const ac3: ConversionSource = {
  MediaStreams: [
    { Type: "Video", Index: 0, Codec: "h264", Width: 640, Height: 360, BitRate: 600_000 },
    { Type: "Audio", Index: 1, Codec: "ac3", Channels: 6, BitRate: 384_000 },
    { Type: "Audio", Index: 2, Codec: "aac", Channels: 2, BitRate: 128_000 },
  ],
  DefaultAudioStreamIndex: 1,
};

const hls = { VideoCodec: "h264,hevc", AudioCodec: "aac", TranscodingMaxAudioChannels: "2" };

describe("streamConversions — ce que demande une URL de flux", () => {
  it("le fichier tel quel ne convertit rien, quelle que soit la casse", () => {
    expect(streamConversions("Videos/abc/stream", { Static: "true" }, mpeg2)).toEqual(NO_CONVERSION);
    expect(streamConversions("Videos/abc/stream.mkv", { static: "TRUE" }, mpeg2)).toEqual(NO_CONVERSION);
  });

  it("hors d'un chemin de flux : rien à juger", () => {
    expect(streamConversions("Items/abc/PlaybackInfo", {}, null)).toBeNull();
    expect(streamConversions("Videos/abc/Trickplay/320/0.jpg", {}, null)).toBeNull();
  });

  it("un HLS qui garde l'image et le son ne fait que changer de conteneur", () => {
    expect(streamConversions("Videos/abc/master.m3u8", hls, h264Mkv)).toEqual({ video: false, audio: false, container: true });
    expect(streamConversions("Videos/abc/hls1/main/0.ts", hls, h264Mkv)).toEqual({ video: false, audio: false, container: true });
  });

  it("une image que la liste ne contient pas est réencodée", () => {
    expect(streamConversions("Videos/abc/master.m3u8", hls, mpeg2)?.video).toBe(true);
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, VideoCodec: "copy" }, mpeg2)?.video).toBe(false);
  });

  it("une copie interdite, une définition ou un débit sous la source : réencodée", () => {
    expect(streamConversions("Videos/abc/main.m3u8", { ...hls, AllowVideoStreamCopy: "false" }, h264Mkv)?.video).toBe(true);
    expect(streamConversions("Videos/abc/main.m3u8", { ...hls, MaxHeight: "240" }, h264Mkv)?.video).toBe(true);
    expect(streamConversions("Videos/abc/main.m3u8", { ...hls, videobitrate: "300000" }, h264Mkv)?.video).toBe(true);
    expect(streamConversions("Videos/abc/main.m3u8", { ...hls, VideoBitrate: "139616000", MaxHeight: "2160" }, h264Mkv)?.video).toBe(false);
  });

  it("un sous-titre incrusté réencode l'image", () => {
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, SubtitleStreamIndex: "3", SubtitleMethod: "Encode" }, h264Mkv)?.video).toBe(true);
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, SubtitleStreamIndex: "3", SubtitleMethod: "Hls" }, h264Mkv)?.video).toBe(false);
  });

  it("le son : codec, canaux et débit de la piste LUE", () => {
    expect(streamConversions("Videos/abc/master.m3u8", hls, ac3)?.audio).toBe(true);
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, AudioCodec: "aac,ac3" }, ac3)?.audio).toBe(true);
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, AudioCodec: "aac,ac3", TranscodingMaxAudioChannels: "6" }, ac3)?.audio).toBe(false);
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, AudioStreamIndex: "2" }, ac3)?.audio).toBe(false);
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, AudioCodec: "aac,ac3", TranscodingMaxAudioChannels: "6", AudioBitrate: "192000" }, ac3)?.audio).toBe(true);
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, AllowAudioStreamCopy: "false" }, h264Mkv)?.audio).toBe(true);
  });

  it("source inconnue : seules les demandes explicites comptent", () => {
    expect(streamConversions("Videos/abc/master.m3u8", hls, null)).toEqual({ video: false, audio: false, container: true });
    expect(streamConversions("Videos/abc/master.m3u8", { ...hls, AllowVideoStreamCopy: "false" }, null)?.video).toBe(true);
  });

  it("l'audio seul n'a pas d'image à juger", () => {
    expect(streamConversions("Audio/abc/universal", { AudioCodec: "aac" }, { MediaStreams: [{ Type: "Audio", Codec: "flac" }] }))
      .toEqual({ video: false, audio: true, container: true });
    expect(streamConversions("Audio/abc/stream", { static: "true" }, null)).toEqual(NO_CONVERSION);
  });
});

describe("playbackRefusal — le compte le permet-il ?", () => {
  const rights = (patch: Partial<PlaybackRights>): PlaybackRights => ({ ...FULL_PLAYBACK_RIGHTS, ...patch });
  const remux = { video: false, audio: false, container: true };

  it("la lecture interdite refuse tout, même le fichier tel quel", () => {
    expect(playbackRefusal(rights({ mediaPlayback: false }), NO_CONVERSION)).toBe("playback_not_allowed");
    expect(playbackRefusal(rights({ mediaPlayback: false }), null)).toBe("playback_not_allowed");
  });

  it("chaque conversion demande SON droit", () => {
    expect(playbackRefusal(rights({ videoTranscoding: false }), { ...remux, video: true })).toBe("conversion_not_allowed");
    expect(playbackRefusal(rights({ audioTranscoding: false }), { ...remux, audio: true })).toBe("conversion_not_allowed");
    expect(playbackRefusal(rights({ remuxing: false }), remux)).toBe("conversion_not_allowed");
  });

  it("un réencodage permis emporte le changement de conteneur", () => {
    expect(playbackRefusal(rights({ remuxing: false }), { ...remux, video: true })).toBeNull();
    expect(playbackRefusal(rights({ videoTranscoding: false }), remux)).toBeNull();
    expect(playbackRefusal(rights({ videoTranscoding: false, audioTranscoding: false, remuxing: false }), NO_CONVERSION)).toBeNull();
  });
});
