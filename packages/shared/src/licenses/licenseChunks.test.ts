import { describe, expect, it } from "vitest";
import { componentBlock, splitLicenseText } from "./licenseChunks";
import { LICENSE_TEXTS } from "./texts";

describe("splitLicenseText", () => {
  it("ne coupe jamais un paragraphe, et ne perd aucun mot", () => {
    for (const text of Object.values(LICENSE_TEXTS)) {
      const chunks = splitLicenseText(text);
      const words = (s: string) => s.split(/\s+/).filter(Boolean);
      expect(words(chunks.join("\n\n"))).toEqual(words(text));
    }
  });

  it("des blocs de taille bornée, sauf un paragraphe à lui seul trop long", () => {
    const chunks = splitLicenseText(LICENSE_TEXTS["AGPL-3.0"], 900);
    expect(chunks.length).toBeGreaterThan(20);
    for (const chunk of chunks) {
      if (chunk.length > 900) expect(chunk.includes("\n\n")).toBe(false);
    }
  });

  it("un texte vide ne donne rien", () => {
    expect(splitLicenseText("  \n\n ")).toEqual([]);
  });
});

describe("componentBlock", () => {
  it("nom et version, licence, mentions, source — sans ligne vide", () => {
    expect(componentBlock({ name: "dav1d", version: "1.5.3", license: "BSD-2-Clause", texts: ["BSD-2-Clause"], source: "https://x", platforms: ["tvos"] }))
      .toBe("dav1d 1.5.3\nBSD-2-Clause\nhttps://x");
  });
});
