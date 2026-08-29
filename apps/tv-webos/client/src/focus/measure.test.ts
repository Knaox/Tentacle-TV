import { describe, expect, it } from "vitest";
import { unscale, readPureScale, type PureScale, type Origin } from "./measure";
import type { Box } from "@tentacle-tv/tv-core";

/**
 * L'inversion doit rendre EXACTEMENT la boîte de mise en page : la navigation
 * compare des bords au pixel, et une erreur d'un demi-pour-cent suffirait à
 * recréer les diagonales qu'on cherche à éteindre.
 */

function box(left: number, top: number, width: number, hauteur: number): Box {
  return { left, top, right: left + width, bottom: top + hauteur };
}

/** Applique la transformation comme le moteur de rendu : autour de l'origine. */
function transformer(source: Box, scale: PureScale, origin: Origin): Box {
  const towardsRender = (point: number, debut: number, axis: "x" | "y") => {
    const o = debut + origin[axis];
    const factor = axis === "x" ? scale.a : scale.d;
    const translation = axis === "x" ? scale.tx : scale.ty;
    return o + factor * (point - o) + translation;
  };

  return {
    left: towardsRender(source.left, source.left, "x"),
    right: towardsRender(source.right, source.left, "x"),
    top: towardsRender(source.top, source.top, "y"),
    bottom: towardsRender(source.bottom, source.top, "y"),
  };
}

describe("lireEchellePure", () => {
  it("ignore l'absence de transformation", () => {
    expect(readPureScale("none")).toBeNull();
    expect(readPureScale("")).toBeNull();
  });

  it("lit l'agrandissement des cartes", () => {
    expect(readPureScale("matrix(1.08, 0, 0, 1.08, 0, 0)")).toEqual({
      a: 1.08,
      d: 1.08,
      tx: 0,
      ty: 0,
    });
  });

  it("ignore une translation pure — c'est du positionnement, pas un effet", () => {
    // Les lignes virtualisées d'une grille se posent par `translateY` :
    // l'annuler renverrait la boîte là où l'élément n'est pas.
    expect(readPureScale("matrix(1, 0, 0, 1, 0, 480)")).toBeNull();
  });

  it("renonce devant une rotation ou un cisaillement", () => {
    expect(readPureScale("matrix(0.87, 0.5, -0.5, 0.87, 0, 0)")).toBeNull();
  });

  it("renonce devant une matrice 3D ou illisible", () => {
    expect(readPureScale("matrix3d(1.08, 0, 0, 0, 0, 1.08, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)")).toBeNull();
    expect(readPureScale("matrix(1.08, 0, 0)")).toBeNull();
  });

  it("renonce devant une échelle nulle, négative ou en cours de disparition", () => {
    expect(readPureScale("matrix(0, 0, 0, 0, 0, 0)")).toBeNull();
    expect(readPureScale("matrix(-1, 0, 0, 1, 0, 0)")).toBeNull();
  });
});

describe("inverserEchelle", () => {
  const CARTE = box(194, 120, 185, 328);

  it("retrouve la carte sous son agrandissement au focus", () => {
    // Le cas réel : scale(1.08), origine « center bottom ». Le bas ne bouge
    // pas, le bord haut remonte de 26 px, les flancs mordent la gouttière.
    const scale: PureScale = { a: 1.08, d: 1.08, tx: 0, ty: 0 };
    const origin: Origin = { x: 92.5, y: 328 };
    const rendered = transformer(CARTE, scale, origin);

    expect(rendered.bottom).toBeCloseTo(CARTE.bottom, 6);
    expect(rendered.top).toBeCloseTo(CARTE.top - 0.08 * 328, 6);

    const recovered = unscale(rendered, scale, origin);
    expect(recovered.left).toBeCloseTo(CARTE.left, 6);
    expect(recovered.right).toBeCloseTo(CARTE.right, 6);
    expect(recovered.top).toBeCloseTo(CARTE.top, 6);
    expect(recovered.bottom).toBeCloseTo(CARTE.bottom, 6);
  });

  it("retrouve la carte quelle que soit l'origine", () => {
    const scale: PureScale = { a: 1.05, d: 1.12, tx: 0, ty: 0 };
    const origin: Origin = { x: 20, y: 47 };
    const recovered = unscale(transformer(CARTE, scale, origin), scale, origin);

    expect(recovered.left).toBeCloseTo(CARTE.left, 6);
    expect(recovered.right).toBeCloseTo(CARTE.right, 6);
    expect(recovered.top).toBeCloseTo(CARTE.top, 6);
    expect(recovered.bottom).toBeCloseTo(CARTE.bottom, 6);
  });

  it("défait aussi la translation qui accompagne une échelle", () => {
    // `translate(-4px, -4px) scale(1.05)` d'un effet de survol se résout en une
    // seule matrice : l'inversion doit défaire l'ensemble, pas la moitié.
    const scale: PureScale = { a: 1.05, d: 1.05, tx: -4, ty: -4 };
    const origin: Origin = { x: 92.5, y: 164 };
    const recovered = unscale(transformer(CARTE, scale, origin), scale, origin);

    expect(recovered.left).toBeCloseTo(CARTE.left, 6);
    expect(recovered.bottom).toBeCloseTo(CARTE.bottom, 6);
  });

  it("l'identité pendant la transition rend la boîte inchangée", () => {
    // Au premier instant de l'animation, la matrice vaut quasiment l'identité ;
    // l'inversion doit être continue, sans saut au démarrage.
    const scale: PureScale = { a: 1.0001, d: 1.0001, tx: 0, ty: 0 };
    const origin: Origin = { x: 92.5, y: 328 };
    const recovered = unscale(transformer(CARTE, scale, origin), scale, origin);

    expect(recovered.left).toBeCloseTo(CARTE.left, 3);
    expect(recovered.top).toBeCloseTo(CARTE.top, 3);
  });
});
