import { describe, expect, it } from "vitest";
import {
  band,
  MARGE_UTILE_X,
  MARGE_UTILE_Y,
  push,
  depth,
  speed,
  MAX_SPEED,
  MIN_SPEED,
  DEAD_ZONE,
} from "./edgeZones";

/** Le canevas réel de la cible, et son retrait d'overscan. */
const CANVAS = { width: 1920, hauteur: 1080 };
const INSET = { x: 96, y: 54 };
const BAND_Y = band(INSET.y, MARGE_UTILE_Y);
const BAND_X = band(INSET.x, MARGE_UTILE_X);

describe("profondeur", () => {
  it("vaut zéro hors de la bande", () => {
    expect(depth(BAND_Y, BAND_Y)).toBe(0);
    expect(depth(BAND_Y + 400, BAND_Y)).toBe(0);
  });

  it("vaut un au bord de la dalle", () => {
    expect(depth(0, BAND_Y)).toBe(1);
  });

  it("ne dépasse jamais un, même dans l'overscan", () => {
    // Une dalle rogne : le pointeur peut se trouver à une coordonnée négative
    // du point de vue de la page. Il n'ira pas plus vite pour autant.
    expect(depth(-40, BAND_Y)).toBe(1);
  });

  it("progresse linéairement entre les deux", () => {
    expect(depth(BAND_Y / 2, BAND_Y)).toBeCloseTo(0.5, 5);
  });
});

describe("vitesse", () => {
  it("reste nulle dans la zone morte", () => {
    expect(speed(0)).toBe(0);
    expect(speed(DEAD_ZONE)).toBe(0);
  });

  it("part du plancher juste après la zone morte", () => {
    expect(speed(DEAD_ZONE + 0.0001)).toBeGreaterThan(0);
    expect(speed(DEAD_ZONE + 0.0001)).toBeCloseTo(MIN_SPEED, 0);
  });

  it("atteint le plafond au bord", () => {
    expect(speed(1)).toBe(MAX_SPEED);
  });

  it("est quadratique : à mi-course, bien en dessous de la moyenne", () => {
    // Une droite rendrait 920. La courbe doit rester nettement en dessous,
    // sinon effleurer la bande fait déjà filer la page.
    const milieu = speed(0.5);
    expect(milieu).toBeLessThan((MIN_SPEED + MAX_SPEED) / 2);
    expect(milieu).toBeGreaterThan(MIN_SPEED);
  });
});

describe("poussee", () => {
  const p = (x: number, y: number) => push(x, y, CANVAS, INSET);

  it("ne demande rien au centre", () => {
    expect(p(960, 540)).toEqual({ x: 0, y: 0 });
  });

  it("descend quand on vise le bas", () => {
    const { x, y } = p(960, 1075);
    expect(x).toBe(0);
    expect(y).toBeGreaterThan(MAX_SPEED * 0.9);
  });

  it("remonte quand on vise le haut", () => {
    const { y } = p(960, 5);
    expect(y).toBeLessThan(-MAX_SPEED * 0.9);
  });

  it("ne bouge pas au bord intérieur de la bande", () => {
    expect(p(960, CANVAS.hauteur - BAND_Y).y).toBe(0);
    expect(p(960, BAND_Y).y).toBe(0);
  });

  it("rampe quand on effleure la bande", () => {
    // Vingt pixels après l'entrée dans la bande : on veut un déplacement lent,
    // celui qui permet de s'arrêter sur la bonne rangée.
    const { y } = p(960, CANVAS.hauteur - BAND_Y + 20);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(MIN_SPEED * 2);
  });

  it("part à droite quand on vise le flanc droit, sans toucher à la verticale", () => {
    const { x, y } = p(1910, 540);
    expect(x).toBeGreaterThan(0);
    expect(y).toBe(0);
  });

  it("part à gauche quand on vise le flanc gauche", () => {
    expect(p(10, 540).x).toBeLessThan(0);
  });

  it("demande les deux axes dans un coin", () => {
    const { x, y } = p(1915, 1070);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it("choisit le bord le plus proche dans une fenêtre plus étroite que deux bandes", () => {
    const narrow = { width: 200, hauteur: 200 };
    expect(push(20, 100, narrow, INSET).x).toBeLessThan(0);
    expect(push(180, 100, narrow, INSET).x).toBeGreaterThan(0);
  });

  it("garde la bande horizontale plus profonde que la verticale", () => {
    // Le geste vertical est le courant : une bande épaisse s'y déclencherait
    // en visant simplement la dernière rangée.
    expect(BAND_X).toBeGreaterThan(BAND_Y);
  });
});
