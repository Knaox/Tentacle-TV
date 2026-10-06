/**
 * Ce que le tableau de bord dit d'une lecture : la sorte, chaque raison de
 * Jellyfin en mots d'administrateur, ce qui change, et l'encodeur.
 */

import { describe, expect, it } from "vitest";
import { SERVER_CAPABILITY_KEYS } from "../serverCapabilities/serverCapabilities";
import type { AdminSessionDto, AdminSourceDto, AdminTranscodingDto } from "../types/adminSessionsDto";
import { containerLabel, explainPlayback, reasonKey, subtitleLabel } from "./explain";

/** Un serveur à jour : il déclare tout. */
const CAPS = new Set(SERVER_CAPABILITY_KEYS);

const SOURCE: AdminSourceDto = {
  container: "mkv", videoCodec: "hevc", videoProfile: "Main 10", videoBitDepth: 10, width: 3840, height: 2160,
  videoRange: "HDR10", audioCodec: "truehd", audioChannels: 8, subtitleCodec: "DVDSUB", bitrate: 40_000_000,
};

type Session = Pick<AdminSessionDto, "playMethod" | "transcoding" | "nowPlaying" | "source">;

function session(transcoding: Partial<AdminTranscodingDto> | null, source: AdminSourceDto | null = SOURCE): Session {
  return {
    playMethod: transcoding === null ? "DirectPlay" : "Transcode",
    nowPlaying: { itemId: "i", name: "Dune", type: "Movie", imageItemId: "i" },
    source,
    transcoding: transcoding === null ? null : { isVideoDirect: false, isAudioDirect: false, reasons: [], ...transcoding },
  };
}

const one = (reason: string, source: AdminSourceDto | null = SOURCE) =>
  explainPlayback(session({ reasons: [reason] }, source), "fr", CAPS).reasons[0];

describe("chaque raison de Jellyfin se dit, avec ses détails quand on les a", () => {
  it.each([
    ["ContainerNotSupported", { container: "MKV" }],
    ["VideoCodecNotSupported", { codec: "HEVC" }],
    ["AudioCodecNotSupported", { codec: "TrueHD" }],
    ["SubtitleCodecNotSupported", { format: "VobSub" }],
    ["VideoRangeTypeNotSupported", { range: "HDR10" }],
    ["AudioChannelsNotSupported", { channels: "7.1" }],
    ["VideoBitDepthNotSupported", { depth: "10" }],
    ["VideoProfileNotSupported", { profile: "Main 10" }],
    ["VideoResolutionNotSupported", { resolution: "4K" }],
  ])("%s → %o", (reason, params) => {
    const line = one(reason);
    expect(line).toEqual({ reason, known: true, params });
    expect(reasonKey(line)).toBe(`reason.${reason}`);
  });

  it("sans le détail, la forme générique — jamais un {{trou}} dans la phrase", () => {
    const line = one("VideoCodecNotSupported", {});
    expect(line.params).toBeNull();
    expect(reasonKey(line)).toBe("reason.VideoCodecNotSupported_generic");
    expect(reasonKey(one("SubtitleCodecNotSupported", null))).toBe("reason.SubtitleCodecNotSupported_generic");
  });

  it.each([
    "AudioIsExternal", "SecondaryAudioNotSupported", "VideoLevelNotSupported", "VideoFramerateNotSupported",
    "RefFramesNotSupported", "AnamorphicVideoNotSupported", "InterlacedVideoNotSupported", "AudioProfileNotSupported",
    "AudioSampleRateNotSupported", "AudioBitDepthNotSupported", "ContainerBitrateExceedsLimit", "AudioBitrateNotSupported",
    "UnknownVideoStreamInfo", "UnknownAudioStreamInfo", "DirectPlayError", "VideoCodecTagNotSupported", "StreamCountExceedsLimit",
  ])("%s : une phrase, sans détail", (reason) => {
    const line = one(reason);
    expect(line).toEqual({ reason, known: true, params: null });
    expect(reasonKey(line)).toBe(`reason.${reason}`);
  });

  it("le débit plafonné se dit une fois : palier de l'appareil ou limite du serveur", () => {
    const { reasons } = explainPlayback(session({ reasons: ["ContainerBitrateExceedsLimit", "VideoBitrateNotSupported"] }), "fr", CAPS);
    expect(reasons.map((r) => r.reason)).toEqual(["ContainerBitrateExceedsLimit"]);
    expect(explainPlayback(session({ reasons: ["VideoBitrateNotSupported"] }), "fr", CAPS).reasons[0].reason)
      .toBe("ContainerBitrateExceedsLimit");
  });

  it("de la plus décisive à la plus anodine ; une raison inconnue va au bout", () => {
    const { reasons } = explainPlayback(session({
      reasons: ["ContainerNotSupported", "FutureReason", "AudioCodecNotSupported", "VideoCodecNotSupported", "SubtitleCodecNotSupported"],
    }), "fr", CAPS);
    expect(reasons.map((r) => r.reason)).toEqual([
      "SubtitleCodecNotSupported", "VideoCodecNotSupported", "AudioCodecNotSupported", "ContainerNotSupported", "FutureReason",
    ]);
    expect(reasons.at(-1)).toEqual({ reason: "FutureReason", known: false, params: null });
  });

  it("une lecture directe n'a pas de raison à dire", () => {
    expect(explainPlayback(session(null), "fr", CAPS)).toEqual({ kind: "direct", reasons: [], changes: [], encoder: null });
  });
});

describe("ce qui change", () => {
  it("transcodage : codec, définition, HDR → SDR, débit, son", () => {
    const e = explainPlayback(session({
      videoCodec: "h264", width: 1920, height: 1080, bitrate: 8_000_000, audioCodec: "aac", audioChannels: 2,
      hardwareAccelerationType: "nvenc", reasons: ["VideoCodecNotSupported"],
    }), "fr", CAPS);
    expect(e.kind).toBe("video");
    expect(e.changes).toEqual(["HEVC → H.264", "4K → 1080p", "HDR10 → SDR", "40 Mb/s → 8,0 Mb/s", "TrueHD 7.1 → AAC 2.0"]);
    expect(e.encoder).toBe("NVENC");
  });

  it("un HDR réencodé en HEVC passe aussi en SDR (Jellyfin tone-mappe tout réencodage, mesuré)", () => {
    const e = explainPlayback(session({
      videoCodec: "hevc", width: 1920, height: 1080, bitrate: 8_000_000, isAudioDirect: true,
      reasons: ["ContainerBitrateExceedsLimit"],
    }), "fr", CAPS);
    expect(e.changes).toContain("HDR10 → SDR");
  });

  it("un plafond au-dessus de la source ne change rien : il ne se dit pas", () => {
    const e = explainPlayback(session({ videoCodec: "h264", bitrate: 18_000_000, isAudioDirect: true }, { ...SOURCE, bitrate: 11_000_000 }), "fr", CAPS);
    expect(e.changes.some((c) => c.includes("Mb/s"))).toBe(false);
  });

  it("un débit d'en-tête absurde ne sert pas de point de départ", () => {
    const e = explainPlayback(session({ videoCodec: "h264", bitrate: 8_000_000, isAudioDirect: true }, { ...SOURCE, bitrate: 144 }), "fr", CAPS);
    expect(e.changes).toContain("8,0 Mb/s");
  });

  it("transcodage audio : seul le son change ; aucun encodeur vidéo", () => {
    const e = explainPlayback(session({ isVideoDirect: true, audioCodec: "aac", audioChannels: 6, hardwareAccelerationType: "none" }), "fr", CAPS);
    expect(e).toMatchObject({ kind: "audio", changes: ["TrueHD 7.1 → AAC 5.1"], encoder: null });
  });

  it("remux : seul le conteneur change", () => {
    const e = explainPlayback(session({ isVideoDirect: true, isAudioDirect: true, container: "mp4", reasons: ["ContainerNotSupported"] }), "fr", CAPS);
    expect(e).toMatchObject({ kind: "remux", changes: ["MKV → MP4"], encoder: null });
  });

  it("encodage logiciel dit, encodeur inconnu tu", () => {
    expect(explainPlayback(session({ videoCodec: "h264", hardwareAccelerationType: "none" }), "fr", CAPS).encoder).toBe("software");
    expect(explainPlayback(session({ videoCodec: "h264" }), "fr", CAPS).encoder).toBeNull();
  });
});

describe("ce que Jellyfin n'a pas reçu, dit quand même (passation du 2026-10-05)", () => {
  // Baby Reindeer S01E03 : HEVC 4K ~20 Mb/s, baisse automatique du bureau à
  // 16,1 Mb/s en H.264 ; Jellyfin enregistre TranscodeReasons: null.
  const baby: AdminSourceDto = { ...SOURCE, bitrate: 20_600_000 };

  it("aucune raison, débit servi sous la source : limite de débit de l'appareil, pas incompatibilité", () => {
    const e = explainPlayback(session({ videoCodec: "h264", bitrate: 16_484_000, reasons: [] }, baby), "fr", CAPS);
    expect(e.kind).toBe("video");
    expect(e.reasons).toEqual([{ reason: "ClientBitrateLimit", known: true, params: null }]);
    expect(reasonKey(e.reasons[0])).toBe("reason.ClientBitrateLimit");
  });

  it("aucune raison et aucun plafond visible : rien d'inventé", () => {
    const e = explainPlayback(session({ videoCodec: "h264", bitrate: 25_000_000, reasons: [] }, baby), "fr", CAPS);
    expect(e.reasons).toEqual([]);
  });

});

describe("libellés", () => {
  it("conteneurs et sous-titres en clair", () => {
    expect(containerLabel("mov,mp4,m4a,3gp,3g2,mj2")).toBe("MP4");
    expect(containerLabel("mkv")).toBe("MKV");
    expect(containerLabel("mpegts")).toBe("TS");
    expect(containerLabel(undefined)).toBeNull();
    expect(subtitleLabel("PGSSUB")).toBe("PGS");
    expect(subtitleLabel("dvd_subtitle")).toBe("VobSub");
    expect(subtitleLabel("subrip")).toBe("SRT");
  });
});
