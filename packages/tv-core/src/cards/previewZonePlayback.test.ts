import { describe, expect, it } from "vitest";
import { PREVIEW_ZONE_HEIGHT } from "../focus/previewZoneLayout";
import {
  PREVIEW_ZONE_HINT,
  PREVIEW_ZONE_WATCH as W,
  previewZoneHintLeft,
  previewZoneHintShown,
  previewZoneWatchLayout,
} from "./previewZonePlayback";
import { PREVIEW_ZONE_TEXT as T } from "./previewZoneText";

const card = { hero: false, synopsis: true, left: 176, mediaLeft: 640 };
const hero = { ...card, hero: true };

/** La hauteur que prend la colonne. */
function used(input: typeof card): number {
  const l = previewZoneWatchLayout(input);
  return l.logoMaxHeight + W.gap + W.meta + W.gap + W.hint + (l.synopsisLines ? W.gap + l.synopsisLines * W.synopsisLine : 0);
}

describe("previewZoneWatchLayout — la version allégée, remplie, à gauche de la vidéo", () => {
  it("une carte : logo, méta, trois lignes de description, l'indice", () => {
    expect(previewZoneWatchLayout(card)).toEqual({ width: 640 - W.gutter - 176, logoMaxHeight: W.logoMax, synopsisLines: 3, bottom: T.bottom });
  });

  it("le héros garde la place de ses boutons : deux lignes", () => {
    const l = previewZoneWatchLayout(hero);
    expect(l.synopsisLines).toBe(2);
    expect(l.bottom).toBe(T.bottom + T.heroActions + T.heroActionsGap);
  });

  it("la colonne ne touche jamais la vidéo et tient sous la marge sûre du haut", () => {
    for (const input of [card, hero, { ...card, synopsis: false }]) {
      const l = previewZoneWatchLayout(input);
      expect(input.left + l.width).toBeLessThanOrEqual(input.mediaLeft - W.gutter);
      expect(used(input) + l.bottom).toBeLessThanOrEqual(PREVIEW_ZONE_HEIGHT - T.safeTop);
    }
  });

  it("sans description, aucune ligne", () => {
    expect(previewZoneWatchLayout({ ...card, synopsis: false }).synopsisLines).toBe(0);
  });
});

describe("previewZoneHintShown — l'indice au départ, puis plus rien", () => {
  it("se lit au départ, s'efface après shownMs", () => {
    expect(previewZoneHintShown({ paused: false, since: 1000, now: 1000 })).toBe(true);
    expect(previewZoneHintShown({ paused: false, since: 1000, now: 1000 + PREVIEW_ZONE_HINT.shownMs - 1 })).toBe(true);
    expect(previewZoneHintShown({ paused: false, since: 1000, now: 1000 + PREVIEW_ZONE_HINT.shownMs })).toBe(false);
  });

  it("reste en pause, et rien sans départ", () => {
    expect(previewZoneHintShown({ paused: true, since: 0, now: 99_999 })).toBe(true);
    expect(previewZoneHintShown({ paused: false, since: null, now: 0 })).toBe(false);
  });

  it("dit ce qu'il reste avant de s'effacer", () => {
    expect(previewZoneHintLeft(1000, 2000)).toBe(PREVIEW_ZONE_HINT.shownMs - 1000);
    expect(previewZoneHintLeft(1000, 99_999)).toBe(0);
    expect(previewZoneHintLeft(null, 0)).toBe(0);
  });
});
