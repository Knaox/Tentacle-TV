import { describe, expect, it } from "vitest";
import { MPV_ENGINE, AVPLAYER_ENGINE, type MediaSource } from "@tentacle-tv/shared";
import { applyTranscodeTarget, buildStreamUrl, fitServerCappedTranscode, type StreamUrlContext } from "./urlBuilder";

const ctx: StreamUrlContext = {
  baseUrl: "http://jf.test",
  deviceId: "dev",
  accessToken: "tok",
  useCredentials: false,
  resolveMediaUrl: (u) => u,
};

const params = (url: string) => new URLSearchParams(url.slice(url.indexOf("?") + 1));

describe("buildStreamUrl — transcodage de qualité", () => {
  it("un palier 540p impose sa largeur (960), son débit vidéo et l'audio stéréo", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 2_528_000, maxHeight: 540 }));
    expect(q.get("MaxWidth")).toBe("960");
    expect(q.get("MaxHeight")).toBe("540");
    expect(q.get("VideoBitrate")).toBe("2400000");
    expect(q.get("AudioBitrate")).toBe("128000");
    expect(q.get("TranscodingMaxAudioChannels")).toBe("2");
    expect(q.get("VideoCodec")).toBe("h264");
  });

  it("un palier 1080p garde le 5.1 et réserve 384 kb/s à l'audio", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 8_384_000, maxHeight: 1080 }));
    expect(q.get("MaxWidth")).toBe("1920");
    expect(q.get("VideoBitrate")).toBe("8000000");
    expect(q.get("TranscodingMaxAudioChannels")).toBe("6");
  });

  it("le repli codec (débit sans hauteur) laisse la définition de la source", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 8_000_000 }));
    expect(q.get("MaxWidth")).toBe("1920");
    expect(q.has("MaxHeight")).toBe(false);
    expect(q.get("VideoBitrate")).toBe(String(8_000_000 - 384_000));
  });

  it("la lecture directe reste un fichier statique, sans plafond", () => {
    const url = buildStreamUrl(ctx, "item", { directPlay: true, mediaSourceId: "ms" });
    expect(url).toContain("/Videos/item/stream?");
    expect(params(url).get("Static")).toBe("true");
  });
});

describe("buildStreamUrl — ce que lit le moteur (planStream)", () => {
  const DTS = { Codec: "dts", BitRate: 768_000, Channels: 6 };

  it("mpv, palier 1080p, DTS 5.1 : son copié, son débit retiré du budget de l'image", () => {
    const q = params(buildStreamUrl(ctx, "item", {
      directPlay: false, maxBitrate: 8_384_000, maxHeight: 1080, engine: MPV_ENGINE, sourceAudio: DTS,
    }));
    expect(q.get("AllowAudioStreamCopy")).toBe("true");
    expect(q.get("AudioCodec")?.split(",")).toContain("dts");
    expect(q.get("AudioBitrate")).toBe("768000");
    expect(q.get("VideoBitrate")).toBe(String(8_384_000 - 768_000));
    expect(q.get("VideoCodec")).toBe("hevc,h264");
    expect(q.get("SegmentContainer")).toBe("ts");
  });

  it("AVPlayer : segments fMP4, HEVC permis, DTS converti", () => {
    const q = params(buildStreamUrl(ctx, "item", {
      directPlay: false, maxBitrate: 8_384_000, maxHeight: 1080, engine: AVPLAYER_ENGINE, sourceAudio: DTS,
    }));
    expect(q.get("SegmentContainer")).toBe("mp4");
    expect(q.get("AudioBitrate")).toBe("384000");
    expect(q.get("AudioCodec")?.split(",")).not.toContain("dts");
  });

  it("remux (sans palier) : l'image copiée sans aucune définition imposée, plages HDR déclarées", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, useProgressiveRemux: false, engine: MPV_ENGINE, sourceAudio: DTS }));
    expect(q.get("AllowVideoStreamCopy")).toBe("true");
    expect(q.has("MaxWidth")).toBe(false);
    expect(q.get("hevc-rangetype")?.split(",")).toEqual(expect.arrayContaining(["HDR10", "DOVIWithHDR10", "DOVI"]));
    expect(q.get("AudioBitrate")).toBe("768000");
  });
});

describe("buildStreamUrl — la raison dite à Jellyfin", () => {
  // Passation du 2026-10-05 : la baisse automatique du bureau arrivait chez
  // Jellyfin sans raison (TranscodeReasons: null) et passait pour une incompatibilité.
  it("un plafond de débit (palier, baisse automatique) : ContainerBitrateExceedsLimit", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 16_484_000, maxHeight: 1080, audioIndex: 2 }));
    expect(q.get("TranscodeReasons")).toBe("ContainerBitrateExceedsLimit");
  });

  it("un sous-titre incrusté s'ajoute à la raison", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 8_000_000, subtitleStreamIndex: 4 }));
    expect(q.get("TranscodeReasons")).toBe("ContainerBitrateExceedsLimit,SubtitleCodecNotSupported");
  });

  it("un repli après erreur dit la sienne, pas un plafond qu'il n'est pas", () => {
    const q = params(buildStreamUrl(ctx, "item", { directPlay: false, maxBitrate: 8_000_000, transcodeReasons: ["DirectPlayError"] }));
    expect(q.get("TranscodeReasons")).toBe("DirectPlayError");
  });

  it("la lecture directe et le remux sans incrustation n'en inventent aucune", () => {
    expect(params(buildStreamUrl(ctx, "item", {})).has("TranscodeReasons")).toBe(false);
    expect(params(buildStreamUrl(ctx, "item", { directPlay: false })).has("TranscodeReasons")).toBe(false);
  });
});

describe("applyTranscodeTarget", () => {
  // La forme exacte que Jellyfin 10.11 rend en PlaybackInfo (relevée au banc).
  const JELLYFIN =
    "/videos/abc/master.m3u8?&DeviceId=d&MediaSourceId=abc&VideoCodec=h264&AudioCodec=aac&AudioStreamIndex=1" +
    "&VideoBitrate=1308000&AudioBitrate=640000&MaxFramerate=23.976025&SegmentContainer=ts&PlaySessionId=ps" +
    "&TranscodingMaxAudioChannels=6&hevc-level=120&h264-level=51&TranscodeReasons=VideoCodecNotSupported";

  it("pose débit, définition et audio du palier", () => {
    const q = params(applyTranscodeTarget(JELLYFIN, { totalBitrate: 2_528_000, height: 540 }));
    expect(q.get("VideoBitrate")).toBe("2400000");
    expect(q.get("AudioBitrate")).toBe("128000");
    expect(q.get("TranscodingMaxAudioChannels")).toBe("2");
    expect(q.get("MaxWidth")).toBe("960");
    expect(q.get("MaxHeight")).toBe("540");
  });

  it("garde tout le reste à l'octet près, et chaque paramètre une seule fois", () => {
    const out = applyTranscodeTarget(JELLYFIN, { totalBitrate: 4_384_000, height: 720 });
    for (const kept of ["DeviceId=d", "PlaySessionId=ps", "hevc-level=120", "MaxFramerate=23.976025", "TranscodeReasons=VideoCodecNotSupported"]) {
      expect(out).toContain(kept);
    }
    expect(out.match(/VideoBitrate=/gi)).toHaveLength(1);
    expect(out.startsWith("/videos/abc/master.m3u8?")).toBe(true);
  });

  it("remplace un paramètre quelle que soit sa casse", () => {
    const out = applyTranscodeTarget("/v/master.m3u8?videobitrate=1&maxwidth=2", { totalBitrate: 4_384_000, height: 720 });
    expect(out.match(/videobitrate=/gi)).toHaveLength(1);
    expect(params(out).get("MaxWidth")).toBe("1280");
  });

  it("garde la copie du son que Jellyfin a prévue (DTS déclaré au profil) si elle tient dans le palier", () => {
    const dtsSource = {
      Id: "abc", Name: "t", Container: "mkv", SupportsDirectPlay: false, SupportsDirectStream: false, SupportsTranscoding: true,
      MediaStreams: [
        { Type: "Video", Codec: "hevc", Index: 0, IsDefault: true, Height: 2160 },
        { Type: "Audio", Codec: "dts", Index: 1, IsDefault: true, BitRate: 768_000, Channels: 6 },
      ],
    } as MediaSource;
    const planned = JELLYFIN.replace("AudioCodec=aac", "AudioCodec=aac,dts").replace("AudioBitrate=640000", "AudioBitrate=768000");
    const q = params(applyTranscodeTarget(planned, { totalBitrate: 8_384_000, height: 1080 }, dtsSource));
    expect(q.get("AudioBitrate")).toBe("768000");
    expect(q.get("VideoBitrate")).toBe(String(8_384_000 - 768_000));
    // Sans la copie prévue par Jellyfin, le budget d'un AAC converti.
    const converted = params(applyTranscodeTarget(JELLYFIN, { totalBitrate: 8_384_000, height: 1080 }, dtsSource));
    expect(converted.get("AudioBitrate")).toBe("384000");
  });

  it("une URL sans paramètres reste telle quelle", () => {
    expect(applyTranscodeTarget("/videos/abc/stream", { totalBitrate: 1_000_000, height: 360 })).toBe("/videos/abc/stream");
  });
});

describe("fitServerCappedTranscode — la limite de débit Internet de Jellyfin", () => {
  const source = (bitrate: number, height = 1080): MediaSource => ({
    Id: "ms", Name: "test", Bitrate: bitrate, Container: "mkv",
    SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true,
    MediaStreams: [{ Type: "Video", Codec: "hevc", Index: 0, IsDefault: true, Height: height, BitRate: bitrate - 200_000 }],
  });
  const jellyfin = (videoBitrate: number, audioBitrate = 192_000) =>
    `/videos/abc/master.m3u8?&DeviceId=d&VideoCodec=h264&VideoBitrate=${videoBitrate}&AudioBitrate=${audioBitrate}&PlaySessionId=ps`;

  it("une limite à 3 Mb/s sur un film 4K : 540p tenu dans la limite, plus le 720p affamé", () => {
    const q = params(fitServerCappedTranscode(jellyfin(2_808_000), source(60_000_000, 2160)));
    expect(q.get("MaxHeight")).toBe("540");
    expect(Number(q.get("VideoBitrate")) + Number(q.get("AudioBitrate"))).toBeLessThanOrEqual(2_808_000 + 192_000);
  });

  it("transcodage de codec à plein débit (aucune limite) : l'URL de Jellyfin, intacte", () => {
    const url = jellyfin(149_808_000);
    expect(fitServerCappedTranscode(url, source(4_600_000))).toBe(url);
  });

  it("limite assez haute pour que Jellyfin garde le 1080p (ou la 4K) : intacte", () => {
    const url = jellyfin(39_808_000);
    expect(fitServerCappedTranscode(url, source(60_000_000, 2160))).toBe(url);
  });

  it("source inconnue ou URL sans débit : intacte", () => {
    expect(fitServerCappedTranscode(jellyfin(2_000_000), undefined)).toBe(jellyfin(2_000_000));
    expect(fitServerCappedTranscode("/videos/abc/master.m3u8?&DeviceId=d", source(9_000_000))).toBe("/videos/abc/master.m3u8?&DeviceId=d");
  });
});

