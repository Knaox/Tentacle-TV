import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { allocateLenses, LENS_BUDGET, type LensCandidate } from "./gpuBudget";
import { GlassLensScope, useLensAllowed } from "./useLensBudget";
import { lensBudgetSnapshot, lensGranted, lensRankOf, registerLens, subscribeLensBudget } from "./lensBudgetStore";

/**
 * Le budget de lentilles (lot lg5, décision « C » du 23/10) : au-delà de huit
 * lentilles visibles, les moins prioritaires restent du givre — jamais une
 * surface (menu, feuille) avant un petit contrôle, jamais une bascule sous le
 * budget.
 */

let order = 0;
const lens = (id: string, rank: LensCandidate["rank"], area: number, visible = true): LensCandidate => ({ id, rank, area, visible, order: order++ });

describe("allocateLenses", () => {
  it("sous le budget : tout le monde garde sa lentille", () => {
    const page = Array.from({ length: LENS_BUDGET }, (_, i) => lens(`c${i}`, "control", 1296));
    expect(allocateLenses(page).size).toBe(LENS_BUDGET);
  });

  it("au-delà : la surface, puis la barre, puis les plus grands contrôles", () => {
    const page = [
      ...Array.from({ length: 8 }, (_, i) => lens(`pastille${i}`, "control", 36 * 36)),
      lens("lecture", "control", 147 * 56),
      lens("barre", "chrome", 655 * 48),
      lens("menu", "surface", 620 * 320),
    ];
    const granted = allocateLenses(page);
    expect([...granted].filter((id) => page.find((c) => c.id === id)?.visible).length).toBe(LENS_BUDGET);
    expect(granted.has("menu")).toBe(true);
    expect(granted.has("barre")).toBe(true);
    expect(granted.has("lecture")).toBe(true);
    // Huit pastilles pour cinq places : les trois DERNIÈRES venues cèdent.
    expect(["pastille5", "pastille6", "pastille7"].some((id) => granted.has(id))).toBe(false);
    expect(["pastille0", "pastille1", "pastille2", "pastille3", "pastille4"].every((id) => granted.has(id))).toBe(true);
  });

  it("hors champ, un verre ne compte pas et garde sa lentille", () => {
    const page = [
      ...Array.from({ length: LENS_BUDGET }, (_, i) => lens(`visible${i}`, "control", 100)),
      lens("dessous", "control", 9999, false),
    ];
    const granted = allocateLenses(page);
    expect(granted.has("dessous")).toBe(true);
    expect(granted.size).toBe(LENS_BUDGET + 1);
  });

  it("un budget nul ou négatif ne rend aucune lentille visible", () => {
    expect(allocateLenses([lens("a", "surface", 10)], 0).size).toBe(0);
    expect(allocateLenses([lens("a", "surface", 10)], -1).size).toBe(0);
  });
});

/** Un élément factice : sa boîte, et s'il vit dans la barre du haut. */
function fakeElement(rect: { x: number; y: number; width: number; height: number }, inHeader = false): Element {
  const box = { ...rect, top: rect.y, left: rect.x, right: rect.x + rect.width, bottom: rect.y + rect.height, toJSON: () => rect };
  return { getBoundingClientRect: () => box, closest: (sel: string) => (inHeader && sel.includes("header") ? {} : null) } as unknown as Element;
}

describe("le magasin de la page", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  it("le rang : surface, chrome de la fenêtre, contrôle", () => {
    expect(lensRankOf(fakeElement({ x: 0, y: 0, width: 10, height: 10 }), true)).toBe("surface");
    expect(lensRankOf(fakeElement({ x: 0, y: 0, width: 10, height: 10 }, true), false)).toBe("chrome");
    expect(lensRankOf(fakeElement({ x: 0, y: 0, width: 10, height: 10 }), false)).toBe("control");
  });

  it("accorde dès l'inscription, retire au-delà du budget, rend au départ d'un autre", () => {
    let notified = 0;
    cleanups.push(subscribeLensBudget(() => (notified += 1)));
    const ids = Array.from({ length: LENS_BUDGET }, (_, i) => `ctl${i}`);
    for (const [i, id] of ids.entries()) cleanups.push(registerLens(id, fakeElement({ x: i * 50, y: 400, width: 44, height: 44 }), "control"));
    expect(ids.every(lensGranted)).toBe(true);
    // Un menu s'ouvre : il prend sa lentille, la dernière pastille arrivée cède la sienne.
    const closeMenu = registerLens("menu", fakeElement({ x: 0, y: 60, width: 620, height: 320 }), "surface");
    expect(lensGranted("menu")).toBe(true);
    expect(lensGranted(ids[LENS_BUDGET - 1]!)).toBe(false);
    expect(lensBudgetSnapshot()).toMatchObject({ registered: LENS_BUDGET + 1, granted: LENS_BUDGET });
    const before = notified;
    closeMenu();
    expect(lensGranted(ids[LENS_BUDGET - 1]!)).toBe(true);
    expect(notified).toBeGreaterThan(before);
  });

  it("une inscription qui ne change le sort de personne ne réveille personne", () => {
    let notified = 0;
    cleanups.push(subscribeLensBudget(() => (notified += 1)));
    cleanups.push(registerLens("seul", fakeElement({ x: 0, y: 0, width: 100, height: 40 }), "chrome"));
    const after = notified;
    // Hors champ (sous la page) : compté accordé, aucune bascule ailleurs.
    cleanups.push(registerLens("loin", fakeElement({ x: 0, y: 99_999, width: 100, height: 40 }), "control"));
    expect(lensGranted("loin")).toBe(true);
    expect(notified - after).toBeLessThanOrEqual(1);
  });
});

describe("la portée (GlassLensScope)", () => {
  const Probe = () => createElement("i", null, String(useLensAllowed()));
  const scope = (lens: boolean, child: ReturnType<typeof createElement>) => createElement(GlassLensScope, { lens, children: child });

  it("permise par défaut, retirée par la portée, rendue par une portée imbriquée", () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<i>true</i>");
    expect(renderToStaticMarkup(scope(false, createElement(Probe)))).toBe("<i>false</i>");
    expect(renderToStaticMarkup(scope(false, scope(true, createElement(Probe))))).toBe("<i>true</i>");
  });

  it("ne dessine rien : hors du mode natif, le DOM d'avant", () => {
    expect(renderToStaticMarkup(scope(false, createElement("b", null, "x")))).toBe("<b>x</b>");
  });
});
