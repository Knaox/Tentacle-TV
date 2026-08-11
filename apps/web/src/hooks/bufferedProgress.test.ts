import { describe, expect, it } from "vitest";
import { fractionChargee, TOLERANCE_PLAGE_S, type PlageTampon } from "./bufferedProgress";

/**
 * Cette valeur ne pilote rien : elle ne fait que dessiner la couche de
 * préchargement de la barre. Mais c'est le seul endroit où l'utilisateur voit sa
 * réserve fondre avant que l'image ne se fige — et sur le téléviseur, elle a
 * affiché zéro pendant des mois sans que personne ne s'en aperçoive. Une barre
 * qui ment est pire qu'une barre absente : on la croit.
 */

const DUREE = 7200;

const plage = (debut: number, fin: number): PlageTampon => ({ debut, fin });

describe("lecture ordinaire", () => {
  it("rend la part chargée d'après la plage en cours", () => {
    expect(fractionChargee([plage(0, 720)], 300, DUREE, 0)).toBeCloseTo(0.1, 5);
  });

  it("retient la plage qui contient la position, pas la plus avancée", () => {
    // La seconde est un reste d'un saut précédent : l'annoncer ferait croire à
    // une réserve qu'on n'a pas devant soi.
    const plages = [plage(0, 400), plage(3600, 4000)];
    expect(fractionChargee(plages, 300, DUREE, 0)).toBeCloseTo(400 / DUREE, 5);
  });

  it("se rabat sur la plage la plus avancée quand aucune ne contient la position", () => {
    expect(fractionChargee([plage(3600, 4000)], 100, DUREE, 0)).toBeCloseTo(4000 / DUREE, 5);
  });

  it("tolère que la position déborde de quelques images", () => {
    const juste = 400 + TOLERANCE_PLAGE_S / 2;
    expect(fractionChargee([plage(0, 400), plage(3600, 4000)], juste, DUREE, 0))
      .toBeCloseTo(400 / DUREE, 5);
  });
});

/**
 * La régression à ne pas commettre. Les flux transcodés portent `CopyTimestamps`
 * et gardent la base d'horodatage du conteneur — 677 secondes sur
 * l'enregistrement de diffusion mesuré dans le dépôt. La position affichée la
 * retranche ; le tampon était lu brut. La couche de préchargement devançait donc
 * la progression de près de dix pour cent, en permanence.
 */
describe("conteneur dont les horodatages ne partent pas de zéro", () => {
  const DECALAGE = 677;

  it("ramène le tampon dans le même temps que la position affichée", () => {
    // Chargé jusqu'à 720 s de FILM, donc 1397 en horodatage brut.
    expect(fractionChargee([plage(DECALAGE, DECALAGE + 720)], DECALAGE + 300, DUREE, DECALAGE))
      .toBeCloseTo(0.1, 5);
  });

  it("ne devance plus la lecture du décalage entier", () => {
    const avec = fractionChargee([plage(DECALAGE, DECALAGE + 720)], DECALAGE + 300, DUREE, DECALAGE)!;
    const sans = fractionChargee([plage(DECALAGE, DECALAGE + 720)], DECALAGE + 300, DUREE, 0)!;
    expect(sans - avec).toBeCloseTo(DECALAGE / DUREE, 5);
  });
});

describe("ce dont on ne peut rien dire", () => {
  it("ne rend rien sans durée exploitable", () => {
    expect(fractionChargee([plage(0, 720)], 300, 0, 0)).toBeNull();
    expect(fractionChargee([plage(0, 720)], 300, Infinity, 0)).toBeNull();
  });

  it("ne rend rien sur un tampon vide", () => {
    expect(fractionChargee([], 300, DUREE, 0)).toBeNull();
  });

  it("ne sort jamais des bornes", () => {
    // Un tampon qui dépasse la durée annoncée ne doit pas déborder la barre,
    // et un décalage plus grand que le tampon ne doit pas la rendre négative.
    expect(fractionChargee([plage(0, DUREE * 2)], 300, DUREE, 0)).toBe(1);
    expect(fractionChargee([plage(0, 100)], 50, DUREE, 500)).toBe(0);
  });

  it("traite la plage unique partant de zéro du téléviseur", () => {
    // La pile média de LG ne rend jamais qu'une plage, et elle commence à zéro :
    // la recherche dégénère et rend la borne haute, faute de mieux.
    expect(fractionChargee([plage(0, 1440)], 1200, DUREE, 0)).toBeCloseTo(0.2, 5);
  });
});
