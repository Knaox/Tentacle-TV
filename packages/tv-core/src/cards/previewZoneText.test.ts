import { describe, expect, it } from "vitest";
import { PREVIEW_ZONE_TEXT as T, previewZoneTextLayout as layout } from "./previewZoneText";

const card = { hero: false, kicker: false, reason: false, synopsis: true };
const hero = { hero: true, kicker: true, reason: false, synopsis: true };

describe("previewZoneTextLayout — le texte se resserre quand la zone descend", () => {
  it("une zone pleine (432) garde tout : carte 3 lignes, héros 2 lignes", () => {
    expect(layout({ ...card, height: 432 })).toEqual({ logoMaxHeight: 120, synopsisLines: 3, bottom: T.bottom });
    expect(layout({ ...hero, height: 432 })).toMatchObject({ logoMaxHeight: 76, synopsisLines: 2 });
  });

  it("le synopsis perd des lignes avant que le logo ne rapetisse", () => {
    const tight = layout({ ...card, height: 368 });
    expect(tight.logoMaxHeight).toBe(120);
    expect(tight.synopsisLines).toBeLessThan(3);
    expect(tight.synopsisLines).toBeGreaterThan(0);
  });

  it("sous le héros, dans une zone basse, le synopsis disparaît plutôt que le logo ne tombe sous son minimum", () => {
    const low = layout({ ...hero, height: 368 });
    expect(low.logoMaxHeight).toBeGreaterThanOrEqual(60);
    expect(low.synopsisLines).toBeLessThanOrEqual(1);
  });

  it("rien ne dépasse la marge sûre du haut, à toute hauteur de 340 à 432", () => {
    for (let height = 340; height <= 432; height += 4) {
      for (const input of [card, hero, { ...card, reason: true }, { ...hero, reason: true }]) {
        const result = layout({ ...input, height });
        const head = (input.kicker ? T.kicker : 0) + (input.reason ? T.reason : 0) + (input.kicker && input.reason ? T.headGap : 0);
        const used = (head ? head + T.gap : 0) + result.logoMaxHeight + T.gap + T.meta + (result.synopsisLines ? T.gap + result.synopsisLines * T.synopsisLine : 0);
        if (result.logoMaxHeight > (input.hero ? 60 : 80)) expect(used).toBeLessThanOrEqual(height - T.safeTop - result.bottom);
      }
    }
  });

  it("le héros garde la place de ses boutons", () => {
    expect(layout({ ...hero, height: 400 }).bottom).toBe(T.bottom + T.heroActions + T.heroActionsGap);
  });
});
