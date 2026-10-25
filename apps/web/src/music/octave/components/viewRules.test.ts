import { describe, expect, it, vi } from "vitest";
import { FALLBACK_TONES, fallbackTone, initialOf, sizedArtworkUrl } from "./artworkTone";
import { columnsFor } from "./cardGrid";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("../../../components/ui/glass/PressableGlass", () => ({ PressableGlass: () => null }));

const { titleSizeClass } = await import("./CollectionHeader");
const { quickPickCount } = await import("../views/QuickPicks");

/**
 * Octave — les règles des vues qui se décident sans écran : le repli d'une
 * pochette absente, la taille demandée pour une vignette, combien de cartes
 * tiennent dans une rangée, la taille d'un titre.
 */

describe("repli d'une pochette", () => {
  it("la même teinte pour le même titre, dans la gamme", () => {
    expect(fallbackTone("Funkorama")).toBe(fallbackTone("Funkorama"));
    for (const s of ["", "a", "Elegant Piano", "Ça déménage", "東京"]) {
      const tone = fallbackTone(s);
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThan(FALLBACK_TONES);
    }
  });
  it("des titres différents ne tombent pas tous sur la même teinte", () => {
    const tones = new Set(["Albums", "Duos d'été", "Funkorama", "Polka", "Bright Wish", "Hustle", "Mouvement 1", "Mouvement 2"].map(fallbackTone));
    expect(tones.size).toBeGreaterThan(2);
  });
  it("l'initiale d'un artiste : la première lettre qui compte", () => {
    expect(initialOf("The Cure")).toBe("C");
    expect(initialOf("les Négresses vertes")).toBe("N");
    expect(initialOf("¡Forward, Russia!")).toBe("F");
    expect(initialOf("élodie")).toBe("É");
    expect(initialOf("2Pac")).toBe("2");
    expect(initialOf("The")).toBe("T");
    expect(initialOf("…")).toBe("");
  });
});

describe("vignette de liste", () => {
  it("une image du cœur reçoit la taille, après ses paramètres", () => {
    expect(sizedArtworkUrl("/api/music/artwork/abc?tag=t1", 128)).toBe("/api/music/artwork/abc?tag=t1&size=128");
    expect(sizedArtworkUrl("/api/music/artwork/abc", 128)).toBe("/api/music/artwork/abc?size=128");
  });
  it("une image d'un autre hôte, ou déjà dimensionnée, reste telle quelle", () => {
    expect(sizedArtworkUrl("https://lh3.example/x.jpg", 128)).toBe("https://lh3.example/x.jpg");
    expect(sizedArtworkUrl("/api/music/artwork/abc?size=512", 128)).toBe("/api/music/artwork/abc?size=512");
  });
});

describe("rangées de cartes", () => {
  it("autant de colonnes que la largeur en tient (règle d'auto-fill : 160 px, écart 4)", () => {
    expect(columnsFor(0)).toBe(0);
    expect(columnsFor(159)).toBe(1);
    expect(columnsFor(324)).toBe(2);
    expect(columnsFor(1080)).toBe(6);
  });
  it("les raccourcis : des rangées pleines, deux au plus", () => {
    expect(quickPickCount(6, 3)).toBe(6);
    expect(quickPickCount(5, 3)).toBe(3);
    expect(quickPickCount(6, 2)).toBe(4);
    expect(quickPickCount(2, 3)).toBe(2);
    expect(quickPickCount(6, 0)).toBe(0);
  });
});

describe("titre d'une collection", () => {
  it("court en grand, long plus petit", () => {
    expect(titleSizeClass("Bad")).toContain("text-6xl");
    expect(titleSizeClass("Bright Piano Works et autres pièces")).toContain("text-4xl");
    expect(titleSizeClass("x".repeat(80))).toContain("text-3xl");
  });
});
