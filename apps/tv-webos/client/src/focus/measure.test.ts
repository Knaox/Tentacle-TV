import { describe, expect, it } from "vitest";
import { inverserEchelle, lireEchellePure, type EchellePure, type Origine } from "./measure";
import type { Boite } from "@tentacle-tv/tv-core";

/**
 * L'inversion doit rendre EXACTEMENT la boîte de mise en page : la navigation
 * compare des bords au pixel, et une erreur d'un demi-pour-cent suffirait à
 * recréer les diagonales qu'on cherche à éteindre.
 */

function boite(gauche: number, haut: number, largeur: number, hauteur: number): Boite {
  return { gauche, haut, droite: gauche + largeur, bas: haut + hauteur };
}

/** Applique la transformation comme le moteur de rendu : autour de l'origine. */
function transformer(source: Boite, echelle: EchellePure, origine: Origine): Boite {
  const versRendu = (point: number, debut: number, axe: "x" | "y") => {
    const o = debut + origine[axe];
    const facteur = axe === "x" ? echelle.a : echelle.d;
    const translation = axe === "x" ? echelle.tx : echelle.ty;
    return o + facteur * (point - o) + translation;
  };

  return {
    gauche: versRendu(source.gauche, source.gauche, "x"),
    droite: versRendu(source.droite, source.gauche, "x"),
    haut: versRendu(source.haut, source.haut, "y"),
    bas: versRendu(source.bas, source.haut, "y"),
  };
}

describe("lireEchellePure", () => {
  it("ignore l'absence de transformation", () => {
    expect(lireEchellePure("none")).toBeNull();
    expect(lireEchellePure("")).toBeNull();
  });

  it("lit l'agrandissement des cartes", () => {
    expect(lireEchellePure("matrix(1.08, 0, 0, 1.08, 0, 0)")).toEqual({
      a: 1.08,
      d: 1.08,
      tx: 0,
      ty: 0,
    });
  });

  it("ignore une translation pure — c'est du positionnement, pas un effet", () => {
    // Les lignes virtualisées d'une grille se posent par `translateY` :
    // l'annuler renverrait la boîte là où l'élément n'est pas.
    expect(lireEchellePure("matrix(1, 0, 0, 1, 0, 480)")).toBeNull();
  });

  it("renonce devant une rotation ou un cisaillement", () => {
    expect(lireEchellePure("matrix(0.87, 0.5, -0.5, 0.87, 0, 0)")).toBeNull();
  });

  it("renonce devant une matrice 3D ou illisible", () => {
    expect(lireEchellePure("matrix3d(1.08, 0, 0, 0, 0, 1.08, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)")).toBeNull();
    expect(lireEchellePure("matrix(1.08, 0, 0)")).toBeNull();
  });

  it("renonce devant une échelle nulle, négative ou en cours de disparition", () => {
    expect(lireEchellePure("matrix(0, 0, 0, 0, 0, 0)")).toBeNull();
    expect(lireEchellePure("matrix(-1, 0, 0, 1, 0, 0)")).toBeNull();
  });
});

describe("inverserEchelle", () => {
  const CARTE = boite(194, 120, 185, 328);

  it("retrouve la carte sous son agrandissement au focus", () => {
    // Le cas réel : scale(1.08), origine « center bottom ». Le bas ne bouge
    // pas, le bord haut remonte de 26 px, les flancs mordent la gouttière.
    const echelle: EchellePure = { a: 1.08, d: 1.08, tx: 0, ty: 0 };
    const origine: Origine = { x: 92.5, y: 328 };
    const rendue = transformer(CARTE, echelle, origine);

    expect(rendue.bas).toBeCloseTo(CARTE.bas, 6);
    expect(rendue.haut).toBeCloseTo(CARTE.haut - 0.08 * 328, 6);

    const retrouvee = inverserEchelle(rendue, echelle, origine);
    expect(retrouvee.gauche).toBeCloseTo(CARTE.gauche, 6);
    expect(retrouvee.droite).toBeCloseTo(CARTE.droite, 6);
    expect(retrouvee.haut).toBeCloseTo(CARTE.haut, 6);
    expect(retrouvee.bas).toBeCloseTo(CARTE.bas, 6);
  });

  it("retrouve la carte quelle que soit l'origine", () => {
    const echelle: EchellePure = { a: 1.05, d: 1.12, tx: 0, ty: 0 };
    const origine: Origine = { x: 20, y: 47 };
    const retrouvee = inverserEchelle(transformer(CARTE, echelle, origine), echelle, origine);

    expect(retrouvee.gauche).toBeCloseTo(CARTE.gauche, 6);
    expect(retrouvee.droite).toBeCloseTo(CARTE.droite, 6);
    expect(retrouvee.haut).toBeCloseTo(CARTE.haut, 6);
    expect(retrouvee.bas).toBeCloseTo(CARTE.bas, 6);
  });

  it("défait aussi la translation qui accompagne une échelle", () => {
    // `translate(-4px, -4px) scale(1.05)` d'un effet de survol se résout en une
    // seule matrice : l'inversion doit défaire l'ensemble, pas la moitié.
    const echelle: EchellePure = { a: 1.05, d: 1.05, tx: -4, ty: -4 };
    const origine: Origine = { x: 92.5, y: 164 };
    const retrouvee = inverserEchelle(transformer(CARTE, echelle, origine), echelle, origine);

    expect(retrouvee.gauche).toBeCloseTo(CARTE.gauche, 6);
    expect(retrouvee.bas).toBeCloseTo(CARTE.bas, 6);
  });

  it("l'identité pendant la transition rend la boîte inchangée", () => {
    // Au premier instant de l'animation, la matrice vaut quasiment l'identité ;
    // l'inversion doit être continue, sans saut au démarrage.
    const echelle: EchellePure = { a: 1.0001, d: 1.0001, tx: 0, ty: 0 };
    const origine: Origine = { x: 92.5, y: 328 };
    const retrouvee = inverserEchelle(transformer(CARTE, echelle, origine), echelle, origine);

    expect(retrouvee.gauche).toBeCloseTo(CARTE.gauche, 3);
    expect(retrouvee.haut).toBeCloseTo(CARTE.haut, 3);
  });
});
