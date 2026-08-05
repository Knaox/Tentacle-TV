import { describe, expect, it } from "vitest";
import { meilleur, noter, surLaMemeLigne, type Boite } from "./geometrie";

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

  it("descend droit même quand la colonne voisine est plus haute", () => {
    // Une carte dont le titre tient sur deux lignes remonte le bord haut de sa
    // voisine. « Bas » doit continuer de viser SA colonne, pas celle dont le
    // bord se trouve être quelques pixels plus proche.
    const depart = boite(440, 0, CARTE.l, CARTE.h);
    const dessous = { element: "dessous", boite: boite(440, 340, CARTE.l, CARTE.h) };
    const voisineHaute = { element: "voisine", boite: boite(660, 330, CARTE.l, CARTE.h) };

    expect(meilleur(depart, [voisineHaute, dessous], "bas")?.element).toBe("dessous");
  });
});

describe("surLaMemeLigne", () => {
  it("reconnaît deux cartes alignées en haut", () => {
    expect(surLaMemeLigne(boite(0, 340, CARTE.l, CARTE.h), boite(220, 340, CARTE.l, CARTE.h))).toBe(
      true,
    );
  });

  it("tolère quelques pixels, comme le reste du module", () => {
    // Les lignes d'une grille en flex ne sont pas alignées au pixel quand les
    // cartes n'ont pas toutes la même hauteur de titre.
    expect(surLaMemeLigne(boite(0, 340, CARTE.l, CARTE.h), boite(220, 343, CARTE.l, CARTE.h))).toBe(
      true,
    );
  });

  it("sépare deux lignes distinctes", () => {
    // Le cas qui compte : « droite » depuis la dernière carte d'une ligne ne
    // doit pas descendre en diagonale sur la première de la suivante.
    expect(surLaMemeLigne(boite(880, 340, CARTE.l, CARTE.h), boite(0, 680, CARTE.l, CARTE.h))).toBe(
      false,
    );
  });

  it("garde ensemble deux cartes de hauteurs différentes", () => {
    // Un titre qui passe sur deux lignes allonge une carte. Elle reste sur la
    // même ligne que sa voisine — leurs centres, eux, sont éloignés de 75 px.
    expect(surLaMemeLigne(boite(0, 340, CARTE.l, CARTE.h), boite(220, 340, CARTE.l, 450))).toBe(
      true,
    );
  });

  it("garde sur la même ligne la carte agrandie par le focus", () => {
    // Le défaut qui rendait les grilles impilotables. La carte visée est
    // agrandie, et un `scale()` centré remonte son bord haut : mesuré sur une
    // bibliothèque, 26 px d'écart, six fois l'ancienne tolérance. Plus aucune
    // voisine n'était « sur la même ligne », la liste de candidats devenait
    // vide, et gauche comme droite ne faisaient plus rien.
    const voisine = boite(0, 0, 185, 328);
    const focalisee = boite(194, -26, 200, 354);
    expect(surLaMemeLigne(focalisee, voisine)).toBe(true);
    expect(surLaMemeLigne(voisine, focalisee)).toBe(true);
  });

  it("ne fait pas mordre une carte agrandie sur la ligne suivante", () => {
    // Le pendant du précédent, et la raison de ne pas simplement élargir la
    // tolérance : l'agrandissement ne doit pas rendre voisine la ligne d'en
    // dessous, sinon « droite » y redescendrait en diagonale.
    const focalisee = boite(194, -26, 200, 354);
    const ligneSuivante = boite(0, 346, 185, 328);
    expect(surLaMemeLigne(focalisee, ligneSuivante)).toBe(false);
  });
});
