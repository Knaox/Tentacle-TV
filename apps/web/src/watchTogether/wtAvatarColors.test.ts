import { describe, expect, it } from "vitest";
import { WT_AVATAR_COLORS, wtAvatarColor } from "./wtAvatarColors";

/** Luminance relative (WCAG 2) d'une couleur `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Le contraste du BLANC posé sur cette couleur. */
const whiteOn = (hex: string): number => 1.05 / (luminance(hex) + 0.05);

describe("les fonds de l'avatar d'un membre sans photo", () => {
  it("l'initiale blanche tient 4,5:1 sur chacun — elle s'écrit en petit, dans le fil comme sur la vidéo", () => {
    for (const color of WT_AVATAR_COLORS) expect(whiteOn(color), color).toBeGreaterThanOrEqual(4.5);
  });

  it("les teintes d'avant n'y arrivaient pas (ce que le banc de contraste a relevé sur le chat)", () => {
    const before = ["#8b5cf6", "#ec4899", "#6366f1", "#a855f7", "#f472b6"];
    for (const color of before) expect(whiteOn(color), color).toBeLessThan(4.5);
  });

  it("un membre garde sa teinte : la même pour un même nom, tirée de la liste", () => {
    expect(wtAvatarColor("Knaoxtest")).toBe(wtAvatarColor("Knaoxtest"));
    expect(WT_AVATAR_COLORS).toContain(wtAvatarColor("Knaoxtest2"));
    expect(WT_AVATAR_COLORS).toContain(wtAvatarColor(""));
    expect(WT_AVATAR_COLORS).toContain(wtAvatarColor("🦑Poulpy🦑"));
  });
});
