import { describe, it, expect } from "vitest";
import { dynamicRanges } from "./codecs";

describe("dynamicRanges", () => {
  it("se limite au SDR quand le moteur ne décode pas le 10 bits", () => {
    expect(dynamicRanges(false)).toEqual(["Unknown", "SDR"]);
  });

  it("déclare le HDR dès que le HEVC Main 10 est décodable, sans regarder l'écran", () => {
    const ranges = dynamicRanges(true);
    expect(ranges).toContain("HDR10");
    expect(ranges).toContain("HDR10Plus");
    expect(ranges).toContain("HLG");
  });

  it("déclare les Dolby Vision à couche de base lisible, jamais le profil 5", () => {
    const ranges = dynamicRanges(true);
    expect(ranges).toContain("DOVIWithHDR10");
    expect(ranges).toContain("DOVIWithHDR10Plus");
    expect(ranges).toContain("DOVIWithHLG");
    expect(ranges).toContain("DOVIWithSDR");
    // `DOVI` nu = profil 5 : aucune couche de base sans décodeur Dolby Vision.
    expect(ranges).not.toContain("DOVI");
  });

  it("garde « Unknown » dans les deux cas — un fichier mal sondé ne doit rien perdre", () => {
    expect(dynamicRanges(false)).toContain("Unknown");
    expect(dynamicRanges(true)).toContain("Unknown");
  });

  it("garde le SDR même en HDR — la liste s'ajoute, elle ne remplace pas", () => {
    expect(dynamicRanges(true)).toContain("SDR");
  });
});
