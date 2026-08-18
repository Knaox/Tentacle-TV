import { describe, expect, it } from "vitest";
import {
  bande,
  MARGE_UTILE_X,
  MARGE_UTILE_Y,
  poussee,
  profondeur,
  vitesse,
  VITESSE_MAX,
  VITESSE_MIN,
  ZONE_MORTE,
} from "./edgeZones";

/** Le canevas réel de la cible, et son retrait d'overscan. */
const CANEVAS = { largeur: 1920, hauteur: 1080 };
const RETRAIT = { x: 96, y: 54 };
const BANDE_Y = bande(RETRAIT.y, MARGE_UTILE_Y);
const BANDE_X = bande(RETRAIT.x, MARGE_UTILE_X);

describe("profondeur", () => {
  it("vaut zéro hors de la bande", () => {
    expect(profondeur(BANDE_Y, BANDE_Y)).toBe(0);
    expect(profondeur(BANDE_Y + 400, BANDE_Y)).toBe(0);
  });

  it("vaut un au bord de la dalle", () => {
    expect(profondeur(0, BANDE_Y)).toBe(1);
  });

  it("ne dépasse jamais un, même dans l'overscan", () => {
    // Une dalle rogne : le pointeur peut se trouver à une coordonnée négative
    // du point de vue de la page. Il n'ira pas plus vite pour autant.
    expect(profondeur(-40, BANDE_Y)).toBe(1);
  });

  it("progresse linéairement entre les deux", () => {
    expect(profondeur(BANDE_Y / 2, BANDE_Y)).toBeCloseTo(0.5, 5);
  });
});

describe("vitesse", () => {
  it("reste nulle dans la zone morte", () => {
    expect(vitesse(0)).toBe(0);
    expect(vitesse(ZONE_MORTE)).toBe(0);
  });

  it("part du plancher juste après la zone morte", () => {
    expect(vitesse(ZONE_MORTE + 0.0001)).toBeGreaterThan(0);
    expect(vitesse(ZONE_MORTE + 0.0001)).toBeCloseTo(VITESSE_MIN, 0);
  });

  it("atteint le plafond au bord", () => {
    expect(vitesse(1)).toBe(VITESSE_MAX);
  });

  it("est quadratique : à mi-course, bien en dessous de la moyenne", () => {
    // Une droite rendrait 920. La courbe doit rester nettement en dessous,
    // sinon effleurer la bande fait déjà filer la page.
    const milieu = vitesse(0.5);
    expect(milieu).toBeLessThan((VITESSE_MIN + VITESSE_MAX) / 2);
    expect(milieu).toBeGreaterThan(VITESSE_MIN);
  });
});

describe("poussee", () => {
  const p = (x: number, y: number) => poussee(x, y, CANEVAS, RETRAIT);

  it("ne demande rien au centre", () => {
    expect(p(960, 540)).toEqual({ x: 0, y: 0 });
  });

  it("descend quand on vise le bas", () => {
    const { x, y } = p(960, 1075);
    expect(x).toBe(0);
    expect(y).toBeGreaterThan(VITESSE_MAX * 0.9);
  });

  it("remonte quand on vise le haut", () => {
    const { y } = p(960, 5);
    expect(y).toBeLessThan(-VITESSE_MAX * 0.9);
  });

  it("ne bouge pas au bord intérieur de la bande", () => {
    expect(p(960, CANEVAS.hauteur - BANDE_Y).y).toBe(0);
    expect(p(960, BANDE_Y).y).toBe(0);
  });

  it("rampe quand on effleure la bande", () => {
    // Vingt pixels après l'entrée dans la bande : on veut un déplacement lent,
    // celui qui permet de s'arrêter sur la bonne rangée.
    const { y } = p(960, CANEVAS.hauteur - BANDE_Y + 20);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(VITESSE_MIN * 2);
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
    const etroit = { largeur: 200, hauteur: 200 };
    expect(poussee(20, 100, etroit, RETRAIT).x).toBeLessThan(0);
    expect(poussee(180, 100, etroit, RETRAIT).x).toBeGreaterThan(0);
  });

  it("garde la bande horizontale plus profonde que la verticale", () => {
    // Le geste vertical est le courant : une bande épaisse s'y déclencherait
    // en visant simplement la dernière rangée.
    expect(BANDE_X).toBeGreaterThan(BANDE_Y);
  });
});
