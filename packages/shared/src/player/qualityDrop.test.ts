import { describe, expect, it } from "vitest";
import { formatMbps, qualityDrop, qualityDropKey, qualityDropText, servedBitrate, type QualityDropInput } from "./qualityDrop";

const url = (query: string) => `/videos/x/master.m3u8?MediaSourceId=a&${query}&PlaySessionId=p`;

function input(over: Partial<QualityDropInput>): QualityDropInput {
  return { auto: true, requestedBps: 120_000_000, cap: null, source: { Bitrate: 14_000_000 }, served: null, ...over };
}

describe("qualityDrop", () => {
  it("se tait hors du mode Auto, même plafonné", () => {
    expect(qualityDrop(input({ auto: false, cap: { measuredBps: 6e6 } }))).toBeNull();
  });

  it("se tait sur une lecture directe sans plafond", () => {
    expect(qualityDrop(input({}))).toBeNull();
  });

  it("dit le réseau mesuré quand NOTRE plafond tient le débit", () => {
    const drop = qualityDrop(input({
      requestedBps: 4_800_000,
      cap: { measuredBps: 6_000_000 },
      served: { TranscodingUrl: url("VideoBitrate=4608000&AudioBitrate=192000&TranscodeReasons=ContainerBitrateExceedsLimit") },
    }));
    expect(drop).toEqual({ cause: "network", measuredBps: 6_000_000, neededBps: 14_000_000 });
  });

  it("reconnaît la limite Internet de Jellyfin : débit servi sous la demande", () => {
    const drop = qualityDrop(input({
      served: {
        TranscodingUrl: url("VideoBitrate=3616000&AudioBitrate=384000"),
        TranscodeReasons: ["ContainerBitrateExceedsLimit"],
      },
    }));
    expect(drop).toEqual({ cause: "remoteLimit", limitBps: 4_000_000 });
  });

  it("préfère la limite du serveur à notre plafond quand elle est plus basse", () => {
    const drop = qualityDrop(input({
      requestedBps: 9_000_000,
      cap: { measuredBps: 11_000_000 },
      served: { TranscodingUrl: url("VideoBitrate=1808000&AudioBitrate=192000&TranscodeReasons=ContainerBitrateExceedsLimit") },
    }));
    expect(drop).toEqual({ cause: "remoteLimit", limitBps: 2_000_000 });
  });

  it("n'accuse pas le serveur quand le débit servi suit la source (pistes audio en trop)", () => {
    // Un conteneur à plusieurs pistes audio : la source pèse plus que vidéo + audio choisi.
    const drop = qualityDrop(input({
      served: { TranscodingUrl: url("VideoBitrate=8000000&AudioBitrate=384000&TranscodeReasons=AudioCodecNotSupported") },
    }));
    expect(drop).toBeNull();
  });

  it("n'accuse pas le serveur pour le plafond du profil d'appareil (remux énorme)", () => {
    const drop = qualityDrop(input({
      source: { Bitrate: 130_000_000 },
      served: { TranscodingUrl: url("VideoBitrate=119616000&AudioBitrate=384000&TranscodeReasons=ContainerBitrateExceedsLimit") },
    }));
    expect(drop).toBeNull();
  });

  it("ne conclut jamais à une limite sans savoir ce qui a été demandé", () => {
    const drop = qualityDrop(input({
      requestedBps: null,
      served: { TranscodingUrl: url("VideoBitrate=3616000&AudioBitrate=384000&TranscodeReasons=ContainerBitrateExceedsLimit") },
    }));
    expect(drop).toBeNull();
  });

  it("dit la conversion du serveur : format, HDR, sous-titres", () => {
    const served = (reasons: string) => ({ TranscodingUrl: url(`VideoBitrate=12000000&TranscodeReasons=${reasons}`) });
    expect(qualityDrop(input({ served: served("VideoCodecNotSupported") })))
      .toEqual({ cause: "server", conversion: "videoFormat" });
    expect(qualityDrop(input({ served: served("VideoRangeTypeNotSupported") })))
      .toEqual({ cause: "server", conversion: "hdr" });
    expect(qualityDrop(input({ served: served("SubtitleCodecNotSupported,AudioCodecNotSupported") })))
      .toEqual({ cause: "server", conversion: "subtitles" });
  });

  it("se tait sur un remux : l'image est copiée", () => {
    const served = (reasons: string) => ({ TranscodingUrl: url(`VideoBitrate=12000000&TranscodeReasons=${reasons}`) });
    expect(qualityDrop(input({ served: served("ContainerNotSupported,AudioCodecNotSupported") }))).toBeNull();
    expect(qualityDrop(input({ served: served("VideoCodecTagNotSupported") }))).toBeNull();
  });

  it("lit les raisons d'un Jellyfin d'avant 10.9 (chaîne à virgules)", () => {
    const drop = qualityDrop(input({
      served: { TranscodingUrl: url("VideoBitrate=12000000"), TranscodeReasons: "AudioCodecNotSupported, VideoCodecNotSupported" },
    }));
    expect(drop).toEqual({ cause: "server", conversion: "videoFormat" });
  });
});

describe("servedBitrate", () => {
  it("additionne vidéo et audio, et rend null sans débit vidéo", () => {
    expect(servedBitrate({ TranscodingUrl: url("VideoBitrate=1000000&AudioBitrate=128000") })).toBe(1_128_000);
    expect(servedBitrate({ TranscodingUrl: url("AudioBitrate=128000") })).toBeNull();
    expect(servedBitrate(null)).toBeNull();
  });
});

describe("qualityDropKey / qualityDropText", () => {
  it("une même baisse garde sa clé, une limite différente en change", () => {
    expect(qualityDropKey({ cause: "network", measuredBps: 5e6, neededBps: 9e6 }))
      .toBe(qualityDropKey({ cause: "network", measuredBps: 6e6, neededBps: 9e6 }));
    expect(qualityDropKey({ cause: "remoteLimit", limitBps: 4e6 }))
      .not.toBe(qualityDropKey({ cause: "remoteLimit", limitBps: 8e6 }));
  });

  it("écrit les débits lisibles, et les clés du message et du menu", () => {
    expect(formatMbps(6_400_000, "en")).toBe("6.4");
    expect(formatMbps(6_400_000, "fr")).toBe("6,4");
    expect(formatMbps(14_200_000, "fr")).toBe("14");
    expect(qualityDropText({ cause: "remoteLimit", limitBps: 4e6 }, "en")).toEqual({
      key: "player:qualityDrop.remoteLimit", menuKey: "player:qualityDropMenu.remoteLimit", values: { limit: "4.0" },
    });
    expect(qualityDropText({ cause: "server", conversion: "hdr" }).key).toBe("player:qualityDrop.server_hdr");
  });
});
