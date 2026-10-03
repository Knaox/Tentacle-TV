import { describe, expect, it } from "vitest";
import type { MediaSource, MediaStream } from "../types/media";
import { capForBitrate, buildQualityLadder, isPresetOffered, findPreset, RELIEF_SHARE } from "./qualityLadder";
import { QUALITY_PRESETS } from "./mediaQuality";
import { TRANSCODE_TIERS, reservedAudioBitrate } from "./transcodeTarget";

/**
 * Source minimale : le débit du conteneur, la piste vidéo (codec, définition,
 * cadence). `bitrate` à `undefined` simule un serveur qui ne le renseigne pas,
 * `height` à `undefined` une piste sans définition connue.
 */
function source(opts: { bitrate?: number; height?: number; bitrateVideo?: number; codec?: string; fps?: number }): MediaSource {
  const video: MediaStream = {
    Type: "Video", Codec: opts.codec ?? "h264", IsDefault: true, Index: 0,
    Height: opts.height, Width: opts.height ? Math.round((opts.height * 16) / 9) : undefined,
    BitRate: opts.bitrateVideo, RealFrameRate: opts.fps,
  };
  return {
    Id: "src", Name: "test", Container: "mkv",
    Bitrate: opts.bitrate,
    SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true,
    MediaStreams: [video],
  };
}

const keys = (presets: readonly { key: string }[]) => presets.map((p) => p.key);
const tier = (key: string) => TRANSCODE_TIERS.find((t) => t.key === key)!;
const videoOf = (p: { bitrate: number | null; height: number | null }) => (p.bitrate ?? 0) - reservedAudioBitrate(p.height);

describe("buildQualityLadder", () => {
  it("un remux 4K reçoit tous les paliers, à leur cible", () => {
    const ladder = buildQualityLadder(source({ bitrate: 60_000_000, height: 2160, codec: "hevc" }));
    expect(keys(ladder)).toEqual(["original", "quality1080pHigh", "quality1080p", "quality720p", "quality480p", "quality360p"]);
    for (const p of ladder.slice(1)) expect(videoOf(p)).toBe(tier(p.key).nominal);
  });

  it("aucun palier ne tombe sous le plancher de sa définition — l'action y partirait en blocs", () => {
    for (const bitrate of [400_000, 900_000, 1_500_000, 2_300_000, 3_000_000, 4_600_000, 7_500_000, 12_000_000, 40_000_000]) {
      for (const codec of ["h264", "hevc", "av1"]) {
        for (const p of buildQualityLadder(source({ bitrate, height: 1080, codec })).slice(1)) {
          expect(videoOf(p)).toBeGreaterThanOrEqual(tier(p.key).floor);
        }
      }
    }
  });

  it("chaque palier allège le flux d'au moins 20 %", () => {
    for (const bitrate of [1_000_000, 3_000_000, 7_500_000, 12_000_000, 21_000_000, 90_000_000]) {
      for (const p of buildQualityLadder(source({ bitrate, height: 1080 })).slice(1)) {
        expect(p.bitrate).toBeLessThanOrEqual(bitrate * RELIEF_SHARE);
      }
    }
  });

  it("l'épisode 1080p en HEVC à 2,3 Mb/s n'a plus de faux « 1080p » à 1,5 Mb/s", () => {
    // Le cas signalé : l'ancien palier « adaptatif » (70 % du débit) donnait un
    // 1080p que Jellyfin servait en 540p et qui partait en blocs dans l'action.
    const ladder = buildQualityLadder(source({ bitrate: 2_260_000, bitrateVideo: 2_070_000, height: 1080, codec: "hevc" }));
    expect(ladder.some((p) => p.height === 1080)).toBe(false);
    expect(ladder.some((p) => p.height === 720)).toBe(false);
    expect(keys(ladder)).toContain("quality360p");
  });

  it("compte la source en H.264 : un HEVC vaut plus que son débit", () => {
    // 12 Mb/s en HEVC ≈ 20 Mb/s en H.264 : le palier 1080p tient sa cible ;
    // le même débit en H.264 aussi. C'est le PLAFOND d'allègement qui borne.
    const hevc = buildQualityLadder(source({ bitrate: 12_000_000, height: 1080, codec: "hevc" }));
    expect(videoOf(findPreset("quality1080p", hevc))).toBe(tier("quality1080p").nominal);
  });

  it("ne propose aucun 1080p sur une source 720p", () => {
    const ladder = buildQualityLadder(source({ bitrate: 6_000_000, height: 720 }));
    expect(ladder.every((p) => (p.height ?? 0) <= 720)).toBe(true);
  });

  it("des débits strictement décroissants, du plus lourd au plus léger", () => {
    for (const bitrate of [2_000_000, 5_000_000, 9_000_000, 30_000_000]) {
      const tiers = buildQualityLadder(source({ bitrate, height: 1080 })).slice(1);
      for (let i = 1; i < tiers.length; i++) expect(tiers[i].bitrate!).toBeLessThan(tiers[i - 1].bitrate!);
    }
  });

  it("« 1080p Haut » n'existe que quand il dépasse vraiment le 1080p", () => {
    const ladder = buildQualityLadder(source({ bitrate: 12_000_000, height: 1080 }));
    expect(isPresetOffered("quality1080pHigh", ladder)).toBe(false);
  });

  it("au-delà de 30 i/s, les paliers demandent plus de débit", () => {
    const at24 = buildQualityLadder(source({ bitrate: 60_000_000, height: 1080, fps: 23.976 }));
    const at60 = buildQualityLadder(source({ bitrate: 60_000_000, height: 1080, fps: 59.94 }));
    expect(findPreset("quality720p", at60).bitrate!).toBeGreaterThan(findPreset("quality720p", at24).bitrate!);
  });

  it("retombe sur le débit de la piste vidéo quand le conteneur ne le donne pas", () => {
    const ladder = buildQualityLadder(source({ bitrateVideo: 40_000_000, height: 1080 }));
    expect(keys(ladder)).toContain("quality1080p");
  });

  it("retombe sur la liste de repli quand le débit est inconnu", () => {
    expect(buildQualityLadder(source({ height: 1080 }))).toEqual([...QUALITY_PRESETS]);
    expect(buildQualityLadder(undefined)).toEqual([...QUALITY_PRESETS]);
    expect(buildQualityLadder(null)).toEqual([...QUALITY_PRESETS]);
  });

  it("une source déjà plus légère que tout palier sain n'offre que « Originale »", () => {
    expect(keys(buildQualityLadder(source({ bitrate: 500_000, height: 480 })))).toEqual(["original"]);
  });
});

describe("QUALITY_PRESETS (repli)", () => {
  it("rend les cibles des paliers, audio compris, sans « 1080p Haut »", () => {
    expect(keys(QUALITY_PRESETS)).toEqual(["original", "quality1080p", "quality720p", "quality480p", "quality360p"]);
    for (const p of QUALITY_PRESETS.slice(1)) expect(videoOf(p)).toBe(tier(p.key).nominal);
  });
});

describe("findPreset", () => {
  it("retombe sur Originale quand la clé n'est plus proposée", () => {
    const ladder = buildQualityLadder(source({ bitrate: 3_000_000, height: 720 }));
    expect(findPreset("quality1080p", ladder).key).toBe("original");
    expect(isPresetOffered("quality1080p", ladder)).toBe(false);
  });

  it("rend le palier demandé quand il existe", () => {
    const ladder = buildQualityLadder(source({ bitrate: 30_000_000, height: 1080 }));
    expect(videoOf(findPreset("quality720p", ladder))).toBe(tier("quality720p").nominal);
    expect(isPresetOffered("quality720p", ladder)).toBe(true);
  });
});

describe("capForBitrate", () => {
  it("ne cape jamais sans mesure — serveur sans BitrateTest, échec réseau", () => {
    expect(capForBitrate(source({ bitrate: 25_000_000, height: 2160 }), null)).toBeNull();
  });

  it("ne cape pas quand la connexion couvre la source avec marge", () => {
    // 25 Mb/s × 1,2 = 30 Mb/s ≤ 40 mesurés → lecture directe tranquille.
    expect(capForBitrate(source({ bitrate: 25_000_000, height: 2160 }), 40_000_000)).toBeNull();
  });

  it("ne cape pas quand le débit source est inconnu", () => {
    expect(capForBitrate(source({}), 6_000_000)).toBeNull();
  });

  it("choisit la plus haute définition que 80 % de la mesure porte au-dessus de son plancher", () => {
    // Juste au-dessus du plancher 720p (audio compris), bien sous celui du 1080p.
    const measured = Math.ceil((tier("quality720p").floor + 384_000 + 200_000) / 0.8);
    const capped = capForBitrate(source({ bitrate: 25_000_000, height: 2160 }), measured);
    expect(capped?.key).toBe("quality720p");
    expect(videoOf(capped!)).toBeGreaterThanOrEqual(tier("quality720p").floor);
  });

  it("adapte le débit à la connexion à l'intérieur d'une définition", () => {
    // Un lien un peu court pour le 720p du menu : l'ancienne règle tombait en
    // 480p ; le 720p à son plancher tient, avec tout le budget.
    const src = source({ bitrate: 25_000_000, height: 2160 });
    const menu720 = findPreset("quality720p", buildQualityLadder(src));
    const measured = Math.floor((menu720.bitrate! - 100_000) / 0.8);
    const capped = capForBitrate(src, measured);
    expect(capped?.key).toBe("quality720p");
    expect(capped!.bitrate!).toBeLessThanOrEqual(measured * 0.8);
    expect(capped!.bitrate!).toBeLessThan(menu720.bitrate!);
  });

  it("ne dépasse jamais le palier du menu, même sur un lien large", () => {
    const src = source({ bitrate: 25_000_000, height: 2160 });
    const capped = capForBitrate(src, 20_000_000);
    expect(capped!.bitrate!).toBeLessThanOrEqual(findPreset(capped!.key, buildQualityLadder(src)).bitrate!);
  });

  it("retombe sur le palier le plus bas quand rien ne tient", () => {
    // Une image modeste vaut mieux qu'un lecteur qui bufferise.
    const capped = capForBitrate(source({ bitrate: 25_000_000, height: 2160 }), 300_000);
    expect(capped?.key).toBe("quality360p");
  });

  it("ne cape pas quand aucun palier n'est plus léger que la source", () => {
    expect(capForBitrate(source({ bitrate: 500_000, height: 480 }), 450_000)).toBeNull();
  });
});
