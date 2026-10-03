import { describe, expect, it } from "vitest";
import {
  TRANSCODE_TIERS, audioChannelsFor, codecEfficiency, frameRateFactor, reservedAudioBitrate, tierWidth, transcodeTarget,
} from "./transcodeTarget";

/**
 * Seuils de Jellyfin (`ResolutionNormalizer` après `ScaleBitrate`, 10.10 → 12) :
 * en dessous, il réduit la définition demandée. Un plancher de palier doit les
 * dépasser, sinon le palier affiché ne serait pas celui produit.
 */
const JELLYFIN_KEEPS_WIDTH: Record<number, number> = { 1920: 6_000_000, 1280: 1_200_000, 854: 275_000, 640: 92_000 };

describe("TRANSCODE_TIERS", () => {
  it("chaque plancher garde la définition que Jellyfin produirait", () => {
    for (const t of TRANSCODE_TIERS) expect(t.floor).toBeGreaterThan(JELLYFIN_KEEPS_WIDTH[t.width]);
  });

  it("cible au-dessus du plancher, et du plus lourd au plus léger", () => {
    for (const t of TRANSCODE_TIERS) expect(t.nominal).toBeGreaterThan(t.floor);
    for (let i = 1; i < TRANSCODE_TIERS.length; i++) {
      expect(TRANSCODE_TIERS[i].nominal).toBeLessThan(TRANSCODE_TIERS[i - 1].nominal);
    }
  });
});

describe("transcodeTarget", () => {
  it("un palier 720p : vidéo = total − audio 5.1, définition imposée", () => {
    expect(transcodeTarget(4_384_000, 720)).toEqual({
      videoBitrate: 4_000_000, audioBitrate: 384_000, audioChannels: 6, maxWidth: 1280, maxHeight: 720,
    });
  });

  it("un palier 480p passe en stéréo à 128 kb/s, largeur 854", () => {
    expect(transcodeTarget(1_928_000, 480)).toEqual({
      videoBitrate: 1_800_000, audioBitrate: 128_000, audioChannels: 2, maxWidth: 854, maxHeight: 480,
    });
  });

  it("sans hauteur (repli codec) : 1920 de large, la définition de la source", () => {
    const target = transcodeTarget(8_000_000);
    expect(target.maxWidth).toBe(1920);
    expect(target.maxHeight).toBeUndefined();
    expect(target.videoBitrate).toBe(8_000_000 - 384_000);
  });

  it("ne descend jamais sous un minimum vidéo, même sur un total absurde", () => {
    expect(transcodeTarget(100_000, 360).videoBitrate).toBeGreaterThanOrEqual(300_000);
  });
});

describe("briques", () => {
  it("efficacité des codecs : celle de Jellyfin", () => {
    expect(codecEfficiency("h264")).toBe(1);
    expect(codecEfficiency("HEVC")).toBe(0.6);
    expect(codecEfficiency("vp9")).toBe(0.6);
    expect(codecEfficiency("av1")).toBe(0.5);
    expect(codecEfficiency(undefined)).toBe(1);
  });

  it("cadence : neutre jusqu'à 30 i/s, √(fps/30) au-delà", () => {
    expect(frameRateFactor(23.976)).toBe(1);
    expect(frameRateFactor(undefined)).toBe(1);
    expect(frameRateFactor(60)).toBeCloseTo(Math.SQRT2, 5);
  });

  it("audio : 5.1 à partir du 720p, stéréo en dessous", () => {
    expect(reservedAudioBitrate(1080)).toBe(384_000);
    expect(audioChannelsFor(720)).toBe(6);
    expect(reservedAudioBitrate(480)).toBe(128_000);
    expect(audioChannelsFor(360)).toBe(2);
  });

  it("largeur d'un palier, et 16:9 hors tableau", () => {
    expect(tierWidth(1080)).toBe(1920);
    expect(tierWidth(480)).toBe(854);
    expect(tierWidth(576)).toBe(1024);
    expect(tierWidth(undefined)).toBe(1920);
  });
});
