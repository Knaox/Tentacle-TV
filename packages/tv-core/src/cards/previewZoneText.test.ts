import { describe, expect, it } from "vitest";
import { PREVIEW_ZONE_HEIGHT } from "../focus/previewZoneLayout";
import { PREVIEW_ZONE_TEXT as T, previewZoneTextLayout as layout, previewZoneUsesLogo, type PreviewZoneTextInput } from "./previewZoneText";

const card = { hero: false, kicker: false, reason: false, synopsis: true };
const hero = { hero: true, kicker: true, reason: false, synopsis: true };

/** La hauteur que prend le texte, au plus. */
function used(input: PreviewZoneTextInput): number {
  const result = layout(input);
  const head = (input.kicker ? T.kicker : 0) + (input.reason ? T.reason : 0) + (input.kicker && input.reason ? T.headGap : 0);
  return (head ? head + T.gap : 0) + result.logoMaxHeight + T.gap + T.meta + (result.synopsisLines ? T.gap + result.synopsisLines * T.synopsisLine : 0);
}

describe("previewZoneTextLayout — le texte de la zone (432, toutes les pages)", () => {
  it("une carte garde tout : grand logo, trois lignes de synopsis", () => {
    expect(layout(card)).toEqual({ logoMaxHeight: 120, synopsisLines: 3, bottom: T.bottom });
  });

  it("une raison prend une ligne au synopsis et un peu de logo", () => {
    expect(layout({ ...card, reason: true })).toMatchObject({ logoMaxHeight: 104, synopsisLines: 2 });
  });

  it("le héros garde la place de ses boutons, son logo et deux lignes de synopsis", () => {
    expect(layout(hero)).toEqual({ logoMaxHeight: 76, synopsisLines: 2, bottom: T.bottom + T.heroActions + T.heroActionsGap });
  });

  it("le héros avec une raison : une seule ligne de synopsis", () => {
    expect(layout({ ...hero, reason: true }).synopsisLines).toBeLessThanOrEqual(1);
  });

  it("sans synopsis, aucune ligne", () => {
    expect(layout({ ...card, synopsis: false }).synopsisLines).toBe(0);
  });

  it("rien ne dépasse la marge sûre du haut, quelle que soit la combinaison", () => {
    for (const isHero of [false, true]) {
      for (const kicker of [false, true]) {
        for (const reason of [false, true]) {
          const input = { hero: isHero, kicker, reason, synopsis: true };
          expect(used(input)).toBeLessThanOrEqual(PREVIEW_ZONE_HEIGHT - T.safeTop - layout(input).bottom);
        }
      }
    }
  });
});

describe("previewZoneUsesLogo — un logo trop étroit cède au titre écrit", () => {
  it("un logo large se pose, un logo vertical ou carré non", () => {
    expect(previewZoneUsesLogo(2.8)).toBe(true);
    expect(previewZoneUsesLogo(1.2)).toBe(true);
    expect(previewZoneUsesLogo(800 / 3904)).toBe(false);
    expect(previewZoneUsesLogo(1)).toBe(false);
    expect(previewZoneUsesLogo(Number.NaN)).toBe(false);
  });
});
