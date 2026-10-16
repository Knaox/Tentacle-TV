import { describe, expect, it } from "vitest";
import { reduceRowHead } from "./trailerPreviewRowHead";
import { SCENE, TILE, row } from "./trailerPreviewRowHead.testRow";

describe("le repli quand le focus passe à droite (pas de vide)", () => {
  it("butée : DROITE de l'avant-dernière à la dernière — la rangée recule de ce que la carte rend, la dernière ne bouge pas", () => {
    const r = row(12);
    r.preview(10);
    expect(r.scrollX).toBe(3734);
    r.send({ type: "blur", index: 10, at: 1000 });
    r.send({ type: "focus", index: 11, at: 1001, tileWidth: TILE });
    // Grande carte de la 10 à 602 → la 11 à 1444 ; après le repli compensé, toujours à 1444.
    const back = reduceRowHead(r.state, { type: "collapse", index: 10, tileWidth: TILE, at: 1002 }, { ...SCENE, cardCount: 12, scrollX: 3734 });
    expect(back).toMatchObject({ scrollTo: 3308, motion: "withCollapse" });
    expect(176 + 11 * 416 - 3308).toBe(1444);
  });

  it("rien quand la rangée est dans son bout naturel (aucun vide possible)", () => {
    const r = row(12);
    r.preview(3);
    r.send({ type: "focus", index: 4, at: 1000 });
    expect(r.send({ type: "collapse", index: 3, tileWidth: TILE, at: 1001 })).toBeNull();
  });

  it("rien quand le focus est passé à GAUCHE : la carte focalisée ne bouge pas avant son aperçu", () => {
    const r = row(12);
    r.preview(11);
    r.send({ type: "blur", index: 11, at: 1000 });
    r.send({ type: "focus", index: 10, at: 1001 });
    expect(r.send({ type: "collapse", index: 11, tileWidth: TILE, at: 1002 })).toBeNull();
  });
});
