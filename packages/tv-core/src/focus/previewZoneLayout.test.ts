import { describe, expect, it } from "vitest";
import {
  BELOW_ZONE_ANCHOR_TOP,
  BELOW_ZONE_BOTTOM_MARGIN,
  BELOW_ZONE_REVEAL,
  BELOW_ZONE_VIEWPORT,
  PREVIEW_STAGE_HEIGHT,
  PREVIEW_ZONE_HEIGHT,
  belowZoneBottomRoom,
  belowZoneFrameCap,
} from "./previewZoneLayout";
import { revealOffset, type RevealPage } from "./reveal";

/** Une page de `count` sections de `height`, espacées de `gap`, sous la zone, avec sa marge du bas. */
function pageOf(count: number, height: number, gap: number, top = 0) {
  const tops = Array.from({ length: count }, (_, i) => top + i * (height + gap));
  const content = tops[count - 1] + height + belowZoneBottomRoom(height);
  const page: RevealPage = { viewport: BELOW_ZONE_VIEWPORT, content, insetTop: 0, insetBottom: 0 };
  return { tops, page, height };
}

describe("previewZoneLayout — la zone en haut, la page dessous", () => {
  it("la zone fait 40 % de l'écran ; la page a le reste", () => {
    expect(PREVIEW_ZONE_HEIGHT).toBe(Math.round(PREVIEW_STAGE_HEIGHT * 0.4));
    expect(BELOW_ZONE_VIEWPORT + PREVIEW_ZONE_HEIGHT).toBe(PREVIEW_STAGE_HEIGHT);
  });

  it("une rangée ou une ligne se montre ANCRÉE, jamais au plus près", () => {
    expect(BELOW_ZONE_REVEAL).toEqual({ mode: "anchor", top: BELOW_ZONE_ANCHOR_TOP });
  });
});

describe("la section focalisée, toujours au même endroit sous la zone", () => {
  // Une grille d'affiches de six colonnes (ligne de 438 + 52), sous un en-tête de 220.
  const grid = pageOf(40, 438, 52, 220);
  // L'accueil : des rangées de vignettes (titre et cartes, 330 + 40), sous la marge du haut.
  const home = pageOf(8, 330, 40, BELOW_ZONE_ANCHOR_TOP);

  it("chaque ligne, la première comme la DERNIÈRE, se pose à la même place à l'écran", () => {
    for (const { tops, page, height } of [grid, home]) {
      for (const [i, top] of tops.entries()) {
        const offset = revealOffset(BELOW_ZONE_REVEAL, { top, height }, page, i === 0 ? 0 : tops[i - 1]);
        expect(top - offset).toBe(BELOW_ZONE_ANCHOR_TOP);
      }
    }
  });

  it("d'où que vienne la page (un pas, une remontée, une rafale) : la même place", () => {
    const { tops, page } = grid;
    for (const base of [0, 1_000, 9_000, page.content]) expect(tops[12] - revealOffset(BELOW_ZONE_REVEAL, { top: tops[12], height: 438 }, page, base)).toBe(BELOW_ZONE_ANCHOR_TOP);
  });

  it("sans la marge du bas, la dernière s'arrêterait plus bas — c'est elle qui la pose", () => {
    const { tops, page } = home;
    const short: RevealPage = { ...page, content: tops[7] + 330 };
    expect(tops[7] - revealOffset(BELOW_ZONE_REVEAL, { top: tops[7], height: 330 }, short, 0)).toBeGreaterThan(BELOW_ZONE_ANCHOR_TOP);
  });
});

describe("belowZoneBottomRoom — la marge du bas", () => {
  it("la fenêtre moins l'ancrage et la dernière section", () => {
    expect(belowZoneBottomRoom(438)).toBe(BELOW_ZONE_VIEWPORT - BELOW_ZONE_ANCHOR_TOP - 438);
  });

  it("jamais négative : une section plus haute que la fenêtre n'en demande aucune", () => {
    expect(belowZoneBottomRoom(BELOW_ZONE_VIEWPORT + 10)).toBe(0);
  });
});

describe("belowZoneFrameCap — l'image d'une rangée tient sous la zone", () => {
  // Le chrome d'une rangée d'affiches : titre 43, écarts 26, légende 72, « Maintenir OK » 32.
  const CHROME = 43 + 26 + 72 + 32;
  const FOCUS = 1.08;

  it("une affiche en taille Grande (468) dépasse le plafond ; en Normale (360), non", () => {
    const cap = belowZoneFrameCap(CHROME, FOCUS);
    expect(468).toBeGreaterThan(cap);
    expect(360).toBeLessThanOrEqual(cap);
  });

  it("au plafond, la section focalisée tient entière, ancrée, au-dessus du bas de l'écran", () => {
    const cap = belowZoneFrameCap(CHROME, FOCUS);
    expect(BELOW_ZONE_ANCHOR_TOP + CHROME + cap * FOCUS + BELOW_ZONE_BOTTOM_MARGIN).toBeLessThanOrEqual(BELOW_ZONE_VIEWPORT);
  });

  it("sans agrandissement au focus (Lite) : le plafond monte d'autant", () => {
    expect(belowZoneFrameCap(CHROME, 1)).toBeGreaterThan(belowZoneFrameCap(CHROME, FOCUS));
  });
});
