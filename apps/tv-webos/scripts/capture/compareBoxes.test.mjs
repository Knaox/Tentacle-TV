import { describe, expect, it } from "vitest";
import { overlaps, divergences } from "./compareBoxes.mjs";

const box = (i, x, y, w, h, t = `t${i}`, parent = null, ou = `div > p#${i}`) =>
  ({ i, parent, t, x, y, w, h, ou });

describe("chevauchements", () => {
  it("signale un titre qui déborde sur son voisin", () => {
    // Le cas mesuré sur la dalle : une tuile d'extra de 208 px dont le titre en
    // fait 299, faute d'étirement — il couvre un tiers de la tuile suivante.
    const clashes = overlaps([
      box(0, 0, 100, 299, 20, "Bande-annonce officielle"),
      box(1, 220, 100, 208, 20, "First Look"),
    ]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].part).toBeGreaterThan(25);
  });

  it("ne compte pas un enfant contenu dans son parent", () => {
    // « Reprendre » entoure « S5 · E1 » : recouvrement de cent pour cent, et
    // aucun défaut. C'est la structure du document.
    const clashes = overlaps([
      box(0, 0, 0, 200, 40, "ReprendreS5 · E1"),
      box(1, 10, 10, 80, 20, "S5 · E1", 0),
    ]);
    expect(clashes).toEqual([]);
  });

  it("remonte toute la chaîne, pas seulement le parent immédiat", () => {
    const clashes = overlaps([
      box(0, 0, 0, 300, 60, "grand-parent"),
      box(1, 0, 0, 200, 40, "parent", 0),
      box(2, 0, 0, 100, 20, "enfant", 1),
    ]);
    expect(clashes).toEqual([]);
  });

  it("laisse passer deux lignes qui se frôlent", () => {
    const clashes = overlaps([
      box(0, 0, 0, 200, 20),
      box(1, 0, 19, 200, 20),
    ]);
    expect(clashes).toEqual([]);
  });

  it("classe les chocs du plus grave au moins grave", () => {
    const clashes = overlaps([
      box(0, 0, 0, 100, 100),
      box(1, 50, 0, 100, 100),
      box(2, 500, 0, 100, 100),
      box(3, 510, 0, 100, 100),
    ]);
    expect(clashes).toHaveLength(2);
    expect(clashes[0].part).toBeGreaterThan(clashes[1].part);
  });

  it("ne divise jamais par zéro sur une boîte plate", () => {
    expect(overlaps([box(0, 0, 0, 0, 0), box(1, 0, 0, 10, 10)])).toEqual([]);
  });
});

describe("divergences", () => {
  const before = [box(0, 10, 10, 100, 20, "Titre"), box(1, 10, 40, 100, 20, "Sous-titre")];

  it("ne dit rien quand rien n'a bougé", () => {
    expect(divergences(before, before)).toEqual([]);
  });

  it("tolère l'arrondi d'un moteur à l'autre", () => {
    const after = [box(0, 11, 10, 100, 20, "Titre"), box(1, 10, 41, 100, 20, "Sous-titre")];
    expect(divergences(before, after)).toEqual([]);
  });

  it("signale un vrai décalage, avec son ampleur", () => {
    const after = [box(0, 10, 10, 100, 20, "Titre"), box(1, 10, 76, 100, 20, "Sous-titre")];
    const d = divergences(before, after);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ genre: "deplacee", dy: 36, worst: 36 });
  });

  it("apparie par le texte et le chemin, jamais par le rang", () => {
    // Une boîte insérée en tête ne doit pas faire passer tout le reste pour
    // déplacé — c'est ce que ferait un appariement positionnel.
    const after = [box(9, 10, 0, 100, 8, "Bandeau", null, "div > p#9"), ...before];
    const d = divergences(before, after);
    expect(d).toEqual([{ genre: "apparue", ou: "div > p#9", t: "Bandeau" }]);
  });

  it("nomme ce qui a disparu", () => {
    const d = divergences(before, [before[0]]);
    expect(d).toEqual([{ genre: "disparue", ou: "div > p#1", t: "Sous-titre" }]);
  });
});
