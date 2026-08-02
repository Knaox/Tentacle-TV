import { describe, expect, it } from "vitest";
import type { MediaSource, MediaStream } from "../types/media";
import { construireEchelleQualite, presetEstPropose, trouverPreset } from "./qualityLadder";
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

const debits = (presets: { bitrate: number | null }[]) => presets.map((p) => p.bitrate);

describe("construireEchelleQualite", () => {
  it("masque tout palier au-dessus du débit source (1080p à 12 Mb/s)", () => {
    const echelle = construireEchelleQualite(source({ bitrate: 12_000_000, height: 1080 }));
    expect(echelle.map((p) => p.key)).toEqual([
      "original", "quality1080p", "quality720p", "quality480p",
    ]);
    expect(debits(echelle)).toEqual([null, 8_000_000, 4_500_000, 1_400_000]);
  });

  it("n'atteint jamais le débit de la source", () => {
    for (const bitrate of [1_000_000, 3_000_000, 7_500_000, 12_000_000, 21_000_000, 90_000_000]) {
      const echelle = construireEchelleQualite(source({ bitrate, height: 1080 }));
      for (const p of echelle.slice(1)) expect(p.bitrate).toBeLessThan(bitrate);
    }
  });

  it("ne propose aucun 1080p sur une source 720p", () => {
    const echelle = construireEchelleQualite(source({ bitrate: 3_000_000, height: 720 }));
    expect(echelle.every((p) => (p.height ?? 0) <= 720)).toBe(true);
    expect(debits(echelle)).toEqual([null, 2_000_000, 1_400_000]);
  });

  it("fabrique un palier adaptatif quand le niveau de la source est vidé", () => {
    // 1080p à 7 Mb/s : les paliers 20 et 8 tombent, il resterait un trou.
    const echelle = construireEchelleQualite(source({ bitrate: 7_000_000, height: 1080 }));
    expect(echelle[1].key).toBe("quality1080p"); // le palier de base, pas « Haut »
    expect(echelle[1].bitrate).toBe(5_000_000); // 70 % de 7, arrondi au demi-Mb/s
    expect(echelle[1].height).toBe(1080);
  });

  it("écarte les paliers dominés (définition plus basse, débit plus élevé)", () => {
    // 1080p à 5 Mb/s : l'adaptatif tombe à 3,5 — le 720p fixe à 4,5 n'a plus de sens.
    const echelle = construireEchelleQualite(source({ bitrate: 5_000_000, height: 1080 }));
    expect(debits(echelle)).toEqual([null, 3_500_000, 1_400_000]);
  });

  it("retombe sur le débit de la piste vidéo quand le conteneur ne le donne pas", () => {
    const echelle = construireEchelleQualite(source({ bitrateVideo: 12_000_000, height: 1080 }));
    expect(debits(echelle)).toEqual([null, 8_000_000, 4_500_000, 1_400_000]);
  });

  it("retombe sur la liste fixe quand le débit est inconnu", () => {
    expect(construireEchelleQualite(source({ height: 1080 }))).toEqual([...QUALITY_PRESETS]);
    expect(construireEchelleQualite(undefined)).toEqual([...QUALITY_PRESETS]);
    expect(construireEchelleQualite(null)).toEqual([...QUALITY_PRESETS]);
  });

  it("ne rend jamais une liste vide, même sur une source minuscule", () => {
    const echelle = construireEchelleQualite(source({ bitrate: 800_000, height: 480 }));
    expect(echelle.length).toBeGreaterThan(1);
    expect(echelle[0].key).toBe("original");
    expect(echelle[1].bitrate).toBeLessThan(800_000);
  });

  it("garde les deux paliers 1080p sur un remux 4K", () => {
    const echelle = construireEchelleQualite(source({ bitrate: 90_000_000, height: 2160 }));
    expect(echelle.map((p) => p.key)).toEqual([
      "original", "quality1080pHigh", "quality1080p", "quality720p", "quality480p",
    ]);
  });
});

describe("trouverPreset", () => {
  it("retombe sur Originale quand la clé n'est plus proposée", () => {
    const echelle = construireEchelleQualite(source({ bitrate: 3_000_000, height: 720 }));
    expect(trouverPreset("quality1080p", echelle).key).toBe("original");
    expect(presetEstPropose("quality1080p", echelle)).toBe(false);
  });

  it("rend le palier demandé quand il existe", () => {
    const echelle = construireEchelleQualite(source({ bitrate: 12_000_000, height: 1080 }));
    expect(trouverPreset("quality720p", echelle).bitrate).toBe(4_500_000);
    expect(presetEstPropose("quality720p", echelle)).toBe(true);
  });
});
