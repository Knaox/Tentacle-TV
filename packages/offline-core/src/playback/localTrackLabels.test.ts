import { describe, expect, it } from "vitest";
import { formatLocalTrackLabel } from "./localTrackLabels";

const fr = { locale: "fr", fallback: "Piste 3" };
const en = { locale: "en", fallback: "Track 3" };

describe("formatLocalTrackLabel", () => {
  it("rend une langue régionale lisible", () => {
    // Le cas signalé : mpv rendait « fr-BE » brut dans le menu.
    expect(formatLocalTrackLabel({ lang: "fr-BE" }, fr)).toBe("Français (Belgique)");
  });

  it("comprend les codes ISO 639-2/B de mpv", () => {
    expect(formatLocalTrackLabel({ lang: "fre" }, fr)).toBe("Français");
    expect(formatLocalTrackLabel({ lang: "ger" }, fr)).toBe("Allemand");
    expect(formatLocalTrackLabel({ lang: "en" }, fr)).toBe("Anglais");
  });

  it("suit la langue d'interface", () => {
    expect(formatLocalTrackLabel({ lang: "fr-BE" }, en)).toBe("French (Belgium)");
    expect(formatLocalTrackLabel({ lang: "jpn" }, en)).toBe("Japanese");
  });

  it("ajoute le codec en suffixe séparé par « - » (badge TrackSelector)", () => {
    expect(formatLocalTrackLabel({ lang: "fre", codec: "aac" }, fr)).toBe("Français - AAC");
    expect(formatLocalTrackLabel({ lang: "eng", codec: "subrip" }, fr)).toBe("Anglais - SRT");
    // Codec verbeux → pas de badge illisible.
    expect(formatLocalTrackLabel({ lang: "fre", codec: "hdmv_pgs_subtitle" }, fr)).toBe("Français - PGS");
  });

  it("signale les pistes forcées et SDH", () => {
    expect(formatLocalTrackLabel({ lang: "fr", forced: true }, fr)).toBe("Français — Forced");
    expect(formatLocalTrackLabel({ lang: "fr", title: "Forced" }, fr)).toBe("Français — Forced");
    expect(formatLocalTrackLabel({ lang: "fr", sdh: true }, fr)).toBe("Français — SDH");
    expect(formatLocalTrackLabel({ lang: "fr", title: "SDH", codec: "ass" }, fr))
      .toBe("Français — SDH - ASS");
  });

  it("ne répète pas un titre qui redit la langue ou un drapeau", () => {
    expect(formatLocalTrackLabel({ lang: "fre", title: "Français" }, fr)).toBe("Français");
    expect(formatLocalTrackLabel({ lang: "fre", title: "[Forced]", forced: true }, fr))
      .toBe("Français — Forced");
  });

  it("conserve un titre informatif", () => {
    expect(formatLocalTrackLabel({ lang: "eng", title: "Director's Commentary" }, fr))
      .toBe("Anglais — Director's Commentary");
    // Sans langue connue, le titre porte seul le libellé.
    expect(formatLocalTrackLabel({ title: "Commentaire" }, fr)).toBe("Commentaire");
  });

  it("retombe sur le code brut puis sur le repli fourni", () => {
    expect(formatLocalTrackLabel({ lang: "zzz" }, fr)).toBe("ZZZ");
    expect(formatLocalTrackLabel({ lang: "und" }, fr)).toBe("Piste 3");
    expect(formatLocalTrackLabel({}, fr)).toBe("Piste 3");
  });
});
