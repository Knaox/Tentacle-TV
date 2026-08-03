import { describe, expect, it } from "vitest";
import { meilleur, noter, type Boite } from "./geometrie";

/**
 * Les cas qui décident si une navigation à la télécommande est agréable ou
 * exaspérante ne se reproduisent pas à la main : deux cartes qui se
 * chevauchent d'un pixel, une rangée décalée, un bouton plus large que sa
 * colonne. D'où ces tests.
 */

function boite(gauche: number, haut: number, largeur: number, hauteur: number): Boite {
  return { gauche, haut, droite: gauche + largeur, bas: haut + hauteur };
}

const CARTE = { l: 200, h: 300 };

describe("noter", () => {
  const depart = boite(0, 0, CARTE.l, CARTE.h);

  it("écarte ce qui se trouve derrière", () => {
    const derriere = boite(-400, 0, CARTE.l, CARTE.h);
    expect(noter(depart, derriere, "droite")).toBeNull();
  });

  it("accepte ce qui se trouve devant", () => {
    const devant = boite(220, 0, CARTE.l, CARTE.h);
    expect(noter(depart, devant, "droite")).toBe(20);
  });

  it("écarte un candidat qui occupe la même place sur l'axe visé", () => {
    const superpose = boite(10, 0, CARTE.l, CARTE.h);
    expect(noter(depart, superpose, "droite")).toBeNull();
  });

  it("ignore un désalignement tant que les projections se chevauchent", () => {
    const aligne = boite(220, 0, CARTE.l, CARTE.h);
    const decale = boite(220, 40, CARTE.l, CARTE.h);
    expect(noter(depart, decale, "droite")).toBe(noter(depart, aligne, "droite"));
  });

  it("pénalise un désalignement franc", () => {
    const aligne = boite(220, 0, CARTE.l, CARTE.h);
    const ailleurs = boite(220, 400, CARTE.l, CARTE.h);
    const scoreAligne = noter(depart, aligne, "droite");
    const scoreAilleurs = noter(depart, ailleurs, "droite");
    expect(scoreAligne).not.toBeNull();
    expect(scoreAilleurs).not.toBeNull();
    expect(scoreAilleurs as number).toBeGreaterThan(scoreAligne as number);
  });

  it("tolère quelques pixels de dépassement", () => {
    // Deux cartes d'une même rangée ne sont pas toujours alignées au pixel ;
    // exiger un franchissement strict en rendrait certaines inatteignables.
    const affleure = boite(198, 0, CARTE.l, CARTE.h);
    expect(noter(depart, affleure, "droite")).not.toBeNull();
  });
});

describe("meilleur", () => {
  it("descend dans la même colonne plutôt qu'en diagonale", () => {
    // Le piège classique d'une grille : la carte en diagonale a son coin plus
    // proche que celle située juste dessous.
    const depart = boite(0, 0, CARTE.l, CARTE.h);
    const dessous = { element: "dessous", boite: boite(0, 320, CARTE.l, CARTE.h) };
    const diagonale = { element: "diagonale", boite: boite(220, 310, CARTE.l, CARTE.h) };

    expect(meilleur(depart, [diagonale, dessous], "bas")?.element).toBe("dessous");
  });

  it("préfère le voisin immédiat au lointain", () => {
    const depart = boite(0, 0, CARTE.l, CARTE.h);
    const proche = { element: "proche", boite: boite(220, 0, CARTE.l, CARTE.h) };
    const loin = { element: "loin", boite: boite(900, 0, CARTE.l, CARTE.h) };

    expect(meilleur(depart, [loin, proche], "droite")?.element).toBe("proche");
  });

  it("ne rend rien quand la direction est vide", () => {
    const depart = boite(500, 0, CARTE.l, CARTE.h);
    const aGauche = { element: "gauche", boite: boite(0, 0, CARTE.l, CARTE.h) };

    expect(meilleur(depart, [aGauche], "droite")).toBeNull();
  });

  it("passe d'une rangée à la suivante en gardant la colonne", () => {
    // Rangée du haut, troisième carte : « bas » doit viser la troisième carte
    // de la rangée du bas, pas la première.
    const depart = boite(440, 0, CARTE.l, CARTE.h);
    const rangeeBasse = [0, 220, 440, 660].map((x) => ({
      element: `x${x}`,
      boite: boite(x, 340, CARTE.l, CARTE.h),
    }));

    expect(meilleur(depart, rangeeBasse, "bas")?.element).toBe("x440");
  });
});
