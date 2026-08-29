import { describe, expect, it } from "vitest";
import type { MediaSource, MediaStream } from "../types/media";
import { capForBitrate, buildQualityLadder, isPresetOffered, findPreset } from "./qualityLadder";
import { QUALITY_PRESETS } from "./mediaQuality";

/**
 * Source minimale : seuls le débit du conteneur et la piste vidéo comptent
 * pour l'échelle. `bitrate` à `undefined` simule un serveur qui ne le renseigne
 * pas, `height` à `undefined` une piste sans définition connue.
 */
function source(opts: { bitrate?: number; height?: number; bitrateVideo?: number }): MediaSource {
  const video: MediaStream = {
    Type: "Video", Codec: "h264", IsDefault: true, Index: 0,
    Height: opts.height, Width: opts.height ? Math.round((opts.height * 16) / 9) : undefined,
    BitRate: opts.bitrateVideo,
  };
  return {
    Id: "src", Name: "test", Container: "mkv",
    Bitrate: opts.bitrate,
    SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true,
    MediaStreams: [video],
  };
}

const bitrates = (presets: { bitrate: number | null }[]) => presets.map((p) => p.bitrate);

describe("buildQualityLadder", () => {
  it("masque tout palier au-dessus du débit source (1080p à 12 Mb/s)", () => {
    const ladder = buildQualityLadder(source({ bitrate: 12_000_000, height: 1080 }));
    expect(ladder.map((p) => p.key)).toEqual([
      "original", "quality1080p", "quality720p", "quality480p",
    ]);
    expect(bitrates(ladder)).toEqual([null, 8_000_000, 4_500_000, 1_400_000]);
  });

  it("n'atteint jamais le débit de la source", () => {
    for (const bitrate of [1_000_000, 3_000_000, 7_500_000, 12_000_000, 21_000_000, 90_000_000]) {
      const ladder = buildQualityLadder(source({ bitrate, height: 1080 }));
      for (const p of ladder.slice(1)) expect(p.bitrate).toBeLessThan(bitrate);
    }
  });

  it("ne propose aucun 1080p sur une source 720p", () => {
    const ladder = buildQualityLadder(source({ bitrate: 3_000_000, height: 720 }));
    expect(ladder.every((p) => (p.height ?? 0) <= 720)).toBe(true);
    expect(bitrates(ladder)).toEqual([null, 2_000_000, 1_400_000]);
  });

  it("fabrique un palier adaptatif quand le niveau de la source est vidé", () => {
    // 1080p à 7 Mb/s : les paliers 20 et 8 tombent, il resterait un trou.
    const ladder = buildQualityLadder(source({ bitrate: 7_000_000, height: 1080 }));
    expect(ladder[1].key).toBe("quality1080p"); // le tier de base, pas « Haut »
    expect(ladder[1].bitrate).toBe(5_000_000); // 70 % de 7, arrondi au demi-Mb/s
    expect(ladder[1].height).toBe(1080);
  });

  it("écarte les paliers dominés (définition plus basse, débit plus élevé)", () => {
    // 1080p à 5 Mb/s : l'adaptatif tombe à 3,5 — le 720p fixe à 4,5 n'a plus de sens.
    const ladder = buildQualityLadder(source({ bitrate: 5_000_000, height: 1080 }));
    expect(bitrates(ladder)).toEqual([null, 3_500_000, 1_400_000]);
  });

  it("retombe sur le débit de la piste vidéo quand le conteneur ne le donne pas", () => {
    const ladder = buildQualityLadder(source({ bitrateVideo: 12_000_000, height: 1080 }));
    expect(bitrates(ladder)).toEqual([null, 8_000_000, 4_500_000, 1_400_000]);
  });

  it("retombe sur la liste fixe quand le débit est inconnu", () => {
    expect(buildQualityLadder(source({ height: 1080 }))).toEqual([...QUALITY_PRESETS]);
    expect(buildQualityLadder(undefined)).toEqual([...QUALITY_PRESETS]);
    expect(buildQualityLadder(null)).toEqual([...QUALITY_PRESETS]);
  });

  it("ne rend jamais une liste vide, même sur une source minuscule", () => {
    const ladder = buildQualityLadder(source({ bitrate: 800_000, height: 480 }));
    expect(ladder.length).toBeGreaterThan(1);
    expect(ladder[0].key).toBe("original");
    expect(ladder[1].bitrate).toBeLessThan(800_000);
  });

  it("garde les deux paliers 1080p sur un remux 4K", () => {
    const ladder = buildQualityLadder(source({ bitrate: 90_000_000, height: 2160 }));
    expect(ladder.map((p) => p.key)).toEqual([
      "original", "quality1080pHigh", "quality1080p", "quality720p", "quality480p",
    ]);
  });
});

describe("findPreset", () => {
  it("retombe sur Originale quand la clé n'est plus proposée", () => {
    const ladder = buildQualityLadder(source({ bitrate: 3_000_000, height: 720 }));
    expect(findPreset("quality1080p", ladder).key).toBe("original");
    expect(isPresetOffered("quality1080p", ladder)).toBe(false);
  });

  it("rend le palier demandé quand il existe", () => {
    const ladder = buildQualityLadder(source({ bitrate: 12_000_000, height: 1080 }));
    expect(findPreset("quality720p", ladder).bitrate).toBe(4_500_000);
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

  it("choisit le meilleur palier qui tient dans 80 % de la mesure", () => {
    // 6 Mb/s mesurés × 0,8 = 4,8 : le 1080p (8) déborde, le 720p (4,5) tient.
    const tier = capForBitrate(source({ bitrate: 25_000_000, height: 2160 }), 6_000_000);
    expect(tier?.key).toBe("quality720p");
    expect(tier?.bitrate).toBe(4_500_000);
  });

  it("retombe sur le palier le plus bas quand rien ne tient", () => {
    // 1 Mb/s mesuré : même le 480p (1,4) déborde — on le prend quand même,
    // une image modeste vaut mieux qu'un lecteur qui bufferise.
    const tier = capForBitrate(source({ bitrate: 25_000_000, height: 2160 }), 1_000_000);
    expect(tier?.key).toBe("quality480p");
  });
});
