import { describe, it, expect } from "vitest";
import { plagesDynamiques } from "./codecs";

describe("plagesDynamiques", () => {
  it("se limite au SDR quand le moteur ne décode pas le 10 bits", () => {
    expect(plagesDynamiques(false)).toEqual(["Unknown", "SDR"]);
  });

  it("déclare le HDR dès que le HEVC Main 10 est décodable, sans regarder l'écran", () => {
    const plages = plagesDynamiques(true);
    expect(plages).toContain("HDR10");
    expect(plages).toContain("HDR10Plus");
    expect(plages).toContain("HLG");
  });

  it("déclare les Dolby Vision à couche de base lisible, jamais le profil 5", () => {
    const plages = plagesDynamiques(true);
    expect(plages).toContain("DOVIWithHDR10");
    expect(plages).toContain("DOVIWithHDR10Plus");
    expect(plages).toContain("DOVIWithHLG");
    expect(plages).toContain("DOVIWithSDR");
    // `DOVI` nu = profil 5 : aucune couche de base sans décodeur Dolby Vision.
    expect(plages).not.toContain("DOVI");
  });

  it("garde « Unknown » dans les deux cas — un fichier mal sondé ne doit rien perdre", () => {
    expect(plagesDynamiques(false)).toContain("Unknown");
    expect(plagesDynamiques(true)).toContain("Unknown");
  });

  it("garde le SDR même en HDR — la liste s'ajoute, elle ne remplace pas", () => {
    expect(plagesDynamiques(true)).toContain("SDR");
  });
});
