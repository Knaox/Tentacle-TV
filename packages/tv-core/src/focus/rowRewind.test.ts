import { describe, expect, it } from "vitest";
import { createRowRewind, rowBackTarget, rowCardOf, rowOnScreen, rowStartKey, type PageView } from "./rowRewind";

/**
 * Une page d'accueil de banc : le héros (0-860), puis quatre rangées de
 * 400 pt, dans une fenêtre de 1080 pt.
 */
const ROWS = { resume: 900, nextUp: 1300, "reco:forYou": 1700, watched: 2100 } as const;
const view = (offset: number): PageView => ({ offset, height: 1080 });

function page() {
  const rewind = createRowRewind();
  for (const [row, top] of Object.entries(ROWS)) {
    rewind.add(row);
    rewind.layout(row, { top, height: 400 });
  }
  return rewind;
}

describe("rowOnScreen — une rangée est à l'écran tant qu'une part d'elle s'y voit", () => {
  it("entière, à moitié, ou d'un seul point", () => {
    expect(rowOnScreen({ top: 900, height: 400 }, view(0))).toBe(true);
    expect(rowOnScreen({ top: 900, height: 400 }, view(1290))).toBe(true);
    expect(rowOnScreen({ top: 900, height: 400 }, view(-170))).toBe(true);
  });

  it("au bord exact, elle est sortie — au-dessus comme au-dessous", () => {
    expect(rowOnScreen({ top: 900, height: 400 }, view(1300))).toBe(false);
    expect(rowOnScreen({ top: 900, height: 400 }, view(-180))).toBe(false);
  });
});

describe("rowCardOf, rowStartKey, rowBackTarget — les cartes d'une rangée déclarée", () => {
  it("la carte et son index, parmi les rangées déclarées", () => {
    expect(rowCardOf("resume:3", ["resume"])).toEqual({ row: "resume", index: 3 });
    expect(rowCardOf("reco:forYou:12", ["reco", "reco:forYou"])).toEqual({ row: "reco:forYou", index: 12 });
  });

  it("ni une clé hors des rangées, ni une rangée non déclarée, ni un préfixe sans index", () => {
    expect(rowCardOf("hero:primary", ["resume"])).toBeNull();
    expect(rowCardOf("cast:2", ["resume"])).toBeNull();
    expect(rowCardOf("reco:forYou:1", ["reco"])).toBeNull();
    expect(rowCardOf(null, ["resume"])).toBeNull();
  });

  it("Retour : la première carte quand le focus est plus loin, rien sur la première", () => {
    expect(rowStartKey("nextUp")).toBe("nextUp:0");
    expect(rowBackTarget("nextUp:4", ["nextUp"])).toBe("nextUp:0");
    expect(rowBackTarget("nextUp:1", ["nextUp"])).toBe("nextUp:0");
    expect(rowBackTarget("nextUp:0", ["nextUp"])).toBeNull();
    expect(rowBackTarget("hero:primary", ["nextUp"])).toBeNull();
  });
});

describe("createRowRewind — à l'écran, la rangée garde sa place", () => {
  it("une carte autre que la première déplace sa rangée ; la première, non", () => {
    const rewind = page();
    rewind.focus("resume:0");
    expect(rewind.moved()).toEqual([]);
    rewind.focus("resume:5");
    expect(rewind.moved()).toEqual(["resume"]);
  });

  it("descendre d'un cran : la rangée du dessus, encore à l'écran, n'est pas touchée", () => {
    const rewind = page();
    rewind.focus("resume:5");
    rewind.focus("nextUp:2");
    expect(rewind.scroll(view(620))).toEqual([]);
    expect(rewind.moved()).toEqual(["resume", "nextUp"]);
  });

  it("une rangée pas encore mesurée n'est jamais remise", () => {
    const rewind = createRowRewind();
    rewind.add("resume");
    rewind.focus("resume:5");
    rewind.focus("hero:primary");
    expect(rewind.scroll(view(5000))).toEqual([]);
  });

  it("une rangée non déclarée (épisodes, saisons, distribution d'une fiche) ne bouge jamais", () => {
    const rewind = page();
    rewind.focus("episodes:7");
    expect(rewind.moved()).toEqual([]);
    expect(rewind.backTarget("episodes:7")).toBeNull();
  });
});

describe("createRowRewind — sortie de l'écran : retour au début, une seule fois", () => {
  it("descendre assez bas : la rangée sortie revient au début, celles encore à l'écran gardent leur place", () => {
    const rewind = page();
    rewind.focus("resume:5");
    rewind.focus("nextUp:3");
    rewind.focus("reco:forYou:0");
    expect(rewind.scroll(view(1300))).toEqual(["resume"]);
    expect(rewind.moved()).toEqual(["nextUp"]);
    expect(rewind.scroll(view(1400))).toEqual([]);
  });

  it("remonter jusqu'au héros : la rangée sortie par le BAS revient au début aussi", () => {
    const rewind = page();
    rewind.focus("watched:6");
    rewind.focus("hero:primary");
    expect(rewind.scroll(view(0))).toEqual(["watched"]);
  });

  it("jamais la rangée qui porte le focus, même mal placée en plein défilement", () => {
    const rewind = page();
    rewind.focus("resume:5");
    expect(rewind.scroll(view(1400))).toEqual([]);
    expect(rewind.moved()).toEqual(["resume"]);
  });

  it("une rangée démontée est oubliée", () => {
    const rewind = page();
    rewind.focus("resume:5");
    rewind.focus("watched:0");
    rewind.remove("resume");
    expect(rewind.scroll(view(2000))).toEqual([]);
    expect(rewind.backTarget("resume:5")).toBeNull();
  });
});

describe("createRowRewind — changer de page par le rail, revenir d'une fiche", () => {
  it("quitter la page À L'ÉCRAN : le focus rendu au début de sa rangée, toutes les rangées déplacées remises tout de suite", () => {
    const rewind = page();
    rewind.focus("resume:5");
    rewind.focus("nextUp:4");
    expect(rewind.startOf("nextUp:4")).toBe("nextUp:0");
    expect(rewind.startOf("hero:primary")).toBe("hero:primary");
    expect(rewind.leave({ visible: true, remembered: "nextUp:4" }).sort()).toEqual(["nextUp", "resume"]);
    expect(rewind.resume("nextUp:0")).toEqual({ rewind: [], claim: "nextUp:0" });
  });

  it("quitter la page COUVERTE (fiche ouverte depuis elle) : la rangée de la carte retenue attend le retour", () => {
    const rewind = page();
    rewind.focus("resume:5");
    rewind.focus("nextUp:4");
    expect(rewind.leave({ visible: false, remembered: "nextUp:4" })).toEqual(["resume"]);
    expect(rewind.moved()).toEqual(["nextUp"]);
    expect(rewind.resume("nextUp:4")).toEqual({ rewind: ["nextUp"], claim: "nextUp:0" });
    expect(rewind.moved()).toEqual([]);
  });

  it("revenir d'une fiche (aucun changement de page) : rien ne bouge, la carte ouverte reprend le focus", () => {
    const rewind = page();
    rewind.focus("nextUp:4");
    expect(rewind.resume("nextUp:4")).toBeNull();
    expect(rewind.moved()).toEqual(["nextUp"]);
  });

  it("le changement de page ne vaut que pour UN retour", () => {
    const rewind = page();
    rewind.focus("hero:primary");
    rewind.leave({ visible: true, remembered: "hero:primary" });
    expect(rewind.resume("hero:primary")).toEqual({ rewind: [], claim: "hero:primary" });
    rewind.focus("resume:3");
    expect(rewind.resume("resume:3")).toBeNull();
  });

  it("une page qui n'avait rien de déplacé n'a rien à remettre", () => {
    const rewind = page();
    rewind.focus("resume:0");
    expect(rewind.leave({ visible: false, remembered: "resume:0" })).toEqual([]);
    expect(rewind.resume("resume:0")).toEqual({ rewind: [], claim: "resume:0" });
  });
});

describe("createRowRewind — Retour dans une rangée défilée", () => {
  it("une fois : la première carte de la rangée ; posée là, plus de cible (le Retour suivant fait ce qu'il faisait)", () => {
    const rewind = page();
    rewind.focus("nextUp:4");
    expect(rewind.backTarget("nextUp:4")).toBe("nextUp:0");
    rewind.focus("nextUp:0");
    expect(rewind.backTarget("nextUp:0")).toBeNull();
  });
});
