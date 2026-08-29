import { describe, expect, it } from "vitest";
import {
  best,
  scoreCandidate,
  restrictToFirstRow,
  onSameColumn,
  onSameRow,
  type Box,
} from "./geometry";

/**
 * Les cas qui décident si une navigation à la télécommande est agréable ou
 * exaspérante ne se reproduisent pas à la main : deux cartes qui se
 * chevauchent d'un pixel, une rangée décalée, un bouton plus large que sa
 * colonne. D'où ces tests.
 */

function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, right: left + width, bottom: top + height };
}

const CARD = { w: 200, h: 300 };

describe("scoreCandidate", () => {
  const from = box(0, 0, CARD.w, CARD.h);

  it("écarte ce qui se trouve derrière", () => {
    const behind = box(-400, 0, CARD.w, CARD.h);
    expect(scoreCandidate(from, behind, "droite")).toBeNull();
  });

  it("accepte ce qui se trouve devant", () => {
    const ahead = box(220, 0, CARD.w, CARD.h);
    expect(scoreCandidate(from, ahead, "droite")).toBe(20);
  });

  it("écarte un candidat qui occupe la même place sur l'axe visé", () => {
    const overlapping = box(10, 0, CARD.w, CARD.h);
    expect(scoreCandidate(from, overlapping, "droite")).toBeNull();
  });

  it("ignore un désalignement tant que les projections se chevauchent", () => {
    const aligned = box(220, 0, CARD.w, CARD.h);
    const offset = box(220, 40, CARD.w, CARD.h);
    expect(scoreCandidate(from, offset, "droite")).toBe(scoreCandidate(from, aligned, "droite"));
  });

  it("pénalise un désalignement franc", () => {
    const aligned = box(220, 0, CARD.w, CARD.h);
    const elsewhere = box(220, 400, CARD.w, CARD.h);
    const scoreAligned = scoreCandidate(from, aligned, "droite");
    const scoreElsewhere = scoreCandidate(from, elsewhere, "droite");
    expect(scoreAligned).not.toBeNull();
    expect(scoreElsewhere).not.toBeNull();
    expect(scoreElsewhere as number).toBeGreaterThan(scoreAligned as number);
  });

  it("tolère quelques pixels de dépassement", () => {
    // Deux cartes d'une même rangée ne sont pas toujours alignées au pixel ;
    // exiger un franchissement strict en rendrait certaines inatteignables.
    const flush = box(198, 0, CARD.w, CARD.h);
    expect(scoreCandidate(from, flush, "droite")).not.toBeNull();
  });
});

describe("scoreCandidate — voisines chevauchantes", () => {
  // Les lignes d'un menu de filtres : 46 px de haut pour un pas de 38 — la
  // passe d'écarts PostCSS pose margin -4px sur toute ligne qui est
  // elle-même flex gap-*, et les boîtes se chevauchent de 8 px, deux fois
  // la tolérance. Cotes relevées sur la dalle.
  const ROW = { w: 358, h: 46 };
  const checked = box(562, 399, ROW.w, ROW.h);
  const above = box(562, 361, ROW.w, ROW.h);
  const below = box(562, 437, ROW.w, ROW.h);

  it("accepte la voisine du dessous malgré le chevauchement", () => {
    expect(scoreCandidate(checked, below, "bas")).toBe(0);
  });

  it("accepte la voisine du dessus malgré le chevauchement", () => {
    // Le cas qui refermait le menu : « haut » depuis l'option cochée ne
    // trouvait aucun candidat, et la première option restait inatteignable.
    expect(scoreCandidate(checked, above, "haut")).toBe(0);
  });

  it("la voisine chevauchante bat la ligne d'après", () => {
    const nextLine = box(562, 475, ROW.w, ROW.h);
    const candidates = [
      { element: "d-apres", box: nextLine },
      { element: "voisine", box: below },
    ];
    expect(best(checked, candidates, "bas")?.element).toBe("voisine");
  });

  it("n'accepte pas pour autant la voisine du mauvais côté", () => {
    // Celle du dessus chevauche aussi — son centre n'a pas franchi celui du
    // départ dans la direction, elle reste écartée de « bas ».
    expect(scoreCandidate(checked, above, "bas")).toBeNull();
  });

  it("continue d'écarter ce qui est au même endroit", () => {
    // Superposition franche (plus de la moitié) : ce n'est pas un voisin.
    const almostSamePlace = box(562, 411, ROW.w, ROW.h);
    expect(scoreCandidate(checked, almostSamePlace, "bas")).toBeNull();
  });

  it("accepte le miroir horizontal — deux pastilles qui se mordent", () => {
    const pill = box(100, 0, 120, 36);
    const bitten = box(212, 0, 120, 36);
    expect(scoreCandidate(pill, bitten, "droite")).toBe(0);
    expect(scoreCandidate(bitten, pill, "gauche")).toBe(0);
  });
});

describe("best", () => {
  it("descend dans la même colonne plutôt qu'en diagonale", () => {
    // Le piège classique d'une grille : la carte en diagonale a son coin plus
    // proche que celle située juste dessous.
    const from = box(0, 0, CARD.w, CARD.h);
    const below = { element: "dessous", box: box(0, 320, CARD.w, CARD.h) };
    const diagonal = { element: "diagonale", box: box(220, 310, CARD.w, CARD.h) };

    expect(best(from, [diagonal, below], "bas")?.element).toBe("dessous");
  });

  it("préfère le voisin immédiat au lointain", () => {
    const from = box(0, 0, CARD.w, CARD.h);
    const near = { element: "proche", box: box(220, 0, CARD.w, CARD.h) };
    const far = { element: "loin", box: box(900, 0, CARD.w, CARD.h) };

    expect(best(from, [far, near], "droite")?.element).toBe("proche");
  });

  it("ne rend rien quand la direction est vide", () => {
    const from = box(500, 0, CARD.w, CARD.h);
    const toTheLeft = { element: "gauche", box: box(0, 0, CARD.w, CARD.h) };

    expect(best(from, [toTheLeft], "droite")).toBeNull();
  });

  it("passe d'une rangée à la suivante en gardant la colonne", () => {
    // Rangée du haut, troisième carte : « bas » doit viser la troisième carte
    // de la rangée du bas, pas la première.
    const from = box(440, 0, CARD.w, CARD.h);
    const bottomRow = [0, 220, 440, 660].map((x) => ({
      element: `x${x}`,
      box: box(x, 340, CARD.w, CARD.h),
    }));

    expect(best(from, bottomRow, "bas")?.element).toBe("x440");
  });

  it("descend droit même quand la colonne voisine est plus haute", () => {
    // Une carte dont le titre tient sur deux lignes remonte le bord haut de sa
    // voisine. « Bas » doit continuer de viser SA colonne, pas celle dont le
    // bord se trouve être quelques pixels plus proche.
    const from = box(440, 0, CARD.w, CARD.h);
    const below = { element: "dessous", box: box(440, 340, CARD.w, CARD.h) };
    const tallNeighbour = { element: "voisine", box: box(660, 330, CARD.w, CARD.h) };

    expect(best(from, [tallNeighbour, below], "bas")?.element).toBe("dessous");
  });
});

describe("onSameRow", () => {
  it("reconnaît deux cartes alignées en haut", () => {
    expect(onSameRow(box(0, 340, CARD.w, CARD.h), box(220, 340, CARD.w, CARD.h))).toBe(
      true,
    );
  });

  it("tolère quelques pixels, comme le reste du module", () => {
    // Les lignes d'une grille en flex ne sont pas alignées au pixel quand les
    // cartes n'ont pas toutes la même hauteur de titre.
    expect(onSameRow(box(0, 340, CARD.w, CARD.h), box(220, 343, CARD.w, CARD.h))).toBe(
      true,
    );
  });

  it("sépare deux lignes distinctes", () => {
    // Le cas qui compte : « droite » depuis la dernière carte d'une ligne ne
    // doit pas descendre en diagonale sur la première de la suivante.
    expect(onSameRow(box(880, 340, CARD.w, CARD.h), box(0, 680, CARD.w, CARD.h))).toBe(
      false,
    );
  });

  it("garde ensemble deux cartes de hauteurs différentes", () => {
    // Un titre qui passe sur deux lignes allonge une carte. Elle reste sur la
    // même ligne que sa voisine — leurs centres, eux, sont éloignés de 75 px.
    expect(onSameRow(box(0, 340, CARD.w, CARD.h), box(220, 340, CARD.w, 450))).toBe(
      true,
    );
  });

  it("garde sur la même ligne la carte agrandie par le focus", () => {
    // Le défaut qui rendait les grilles impilotables. La carte visée est
    // agrandie, et un `scale()` centré remonte son bord haut : mesuré sur une
    // bibliothèque, 26 px d'écart, six fois l'ancienne tolérance. Plus aucune
    // voisine n'était « sur la même ligne », la liste de candidats devenait
    // vide, et gauche comme droite ne faisaient plus rien.
    const neighbour = box(0, 0, 185, 328);
    const focused = box(194, -26, 200, 354);
    expect(onSameRow(focused, neighbour)).toBe(true);
    expect(onSameRow(neighbour, focused)).toBe(true);
  });

  it("ne fait pas mordre une carte agrandie sur la ligne suivante", () => {
    // Le pendant du précédent, et la raison de ne pas simplement élargir la
    // tolérance : l'agrandissement ne doit pas rendre voisine la ligne d'en
    // dessous, sinon « droite » y redescendrait en diagonale.
    const focused = box(194, -26, 200, 354);
    const nextRow = box(0, 346, 185, 328);
    expect(onSameRow(focused, nextRow)).toBe(false);
  });
});

describe("onSameColumn", () => {
  it("reconnaît deux cartes empilées", () => {
    expect(onSameColumn(box(220, 0, CARD.w, CARD.h), box(220, 340, CARD.w, CARD.h))).toBe(
      true,
    );
  });

  it("sépare deux colonnes voisines malgré l'agrandissement au focus", () => {
    // La carte focalisée déborde de ~7 px dans une gouttière de 16 : ses flancs
    // mordent la colonne voisine sans jamais en recouvrir la moitié.
    const focused = box(212, -26, 200, 354);
    const neighbourColumn = box(421, 340, 185, 328);
    expect(onSameColumn(focused, neighbourColumn)).toBe(false);
  });

  it("garde ensemble deux cartes de largeurs différentes", () => {
    expect(onSameColumn(box(220, 0, CARD.w, CARD.h), box(200, 340, 260, CARD.h))).toBe(
      true,
    );
  });
});

describe("restrictToFirstRow", () => {
  it("s'arrête à la rangée suivante quand la colonne est orpheline", () => {
    // Dernière rangée incomplète : depuis la colonne 4, « bas » doit proposer
    // la rangée d'en dessous — pas celle d'encore après, même mieux alignée.
    const from = box(880, 0, CARD.w, CARD.h);
    const partialRow = [0, 220].map((x) => ({
      element: `r1x${x}`,
      box: box(x, 340, CARD.w, CARD.h),
    }));
    const farRow = [880].map((x) => ({
      element: `r2x${x}`,
      box: box(x, 680, CARD.w, CARD.h),
    }));

    const kept = restrictToFirstRow(
      from,
      [...farRow, ...partialRow],
      "bas",
    );
    expect(kept.map((candidate) => candidate.element).sort()).toEqual(["r1x0", "r1x220"]);
    expect(best(from, kept, "bas")?.element).toBe("r1x220");
  });

  it("ne rend rien quand la direction est vide", () => {
    const from = box(0, 680, CARD.w, CARD.h);
    const auDessus = [{ element: "dessus", box: box(0, 340, CARD.w, CARD.h) }];
    expect(restrictToFirstRow(from, auDessus, "bas")).toEqual([]);
  });

  it("écarte ce qui recouvre le départ sur l'axe visé", () => {
    const from = box(0, 0, CARD.w, CARD.h);
    const samePlace = [{ element: "ici", box: box(10, 4, CARD.w, CARD.h) }];
    expect(restrictToFirstRow(from, samePlace, "bas")).toEqual([]);
  });

  it("prend une voisine chevauchante comme première ligne", () => {
    // Sans la même acceptation que `noter`, la bande de référence serait la
    // ligne d'APRÈS la voisine à marge négative — et la restriction
    // reproduirait le saut qu'elle est censée empêcher.
    const checked = box(562, 399, 358, 46);
    const neighbour = { element: "voisine", box: box(562, 437, 358, 46) };
    const nextLine = { element: "d-apres", box: box(562, 475, 358, 46) };

    const kept = restrictToFirstRow(checked, [nextLine, neighbour], "bas");
    expect(kept.map((candidate) => candidate.element)).toEqual(["voisine"]);
  });
});
