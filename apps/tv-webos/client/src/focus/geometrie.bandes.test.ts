import { describe, expect, it } from "vitest";
import { meilleur, restreindreALaPremiereLigne, type Boite } from "./geometrie";
import type { Direction } from "./touches";

/**
 * La restriction à la première bande, sur les cotes RÉELLES de la fiche
 * média (1280×720, relevées au harnais). C'est la composition qu'applique
 * `deplacement.ts` à tout mouvement vertical hors grille : restreindre à la
 * ligne visuelle du candidat le plus proche, puis laisser le score
 * départager DANS la bande. Fichier séparé de `geometrie.test.ts` : la
 * limite des trois cents lignes n'y laissait pas la place.
 *
 * Les deux défauts qui ont exigé cette règle, mesurés sur la dalle :
 * « bas » depuis Retour filait à la tuile d'extras — elle partage sa
 * gouttière, désalignement nul, score ~600 contre ~790 pour « Reprendre »
 * décalé à droite — et « bas » depuis une pastille ronde enjambait extras
 * et saisons jusqu'à la ligne d'épisode, pleine largeur donc jamais
 * désalignée (score ~467 contre ~2000 pour l'onglet).
 */

function boite(gauche: number, haut: number, largeur: number, hauteur: number): Boite {
  return { gauche, haut, droite: gauche + largeur, bas: haut + hauteur };
}

const RETOUR = boite(72, 40, 95, 46);
const VOIR_PLUS = boite(304, 464, 70, 24);
const LECTURE = boite(304, 501, 181, 56);
const MA_LISTE = boite(715, 501, 56, 56);
const EXTRA_1 = boite(56, 677, 208, 117);
const EXTRA_4 = boite(728, 677, 208, 117);
const SAISON_1 = boite(32, 947, 106, 42);
const SAISON_2 = boite(150, 947, 110, 42);
const SAISON_3 = boite(272, 947, 110, 42);
const EPISODE_1 = boite(32, 1017, 1216, 125);

function nomme(entrees: Record<string, Boite>) {
  return Object.entries(entrees).map(([element, boiteDeLElement]) => ({
    element,
    boite: boiteDeLElement,
  }));
}

function gagnant(depart: Boite, candidats: Array<{ element: string; boite: Boite }>, direction: Direction) {
  const bande = restreindreALaPremiereLigne(depart, candidats, direction);
  const retenus = bande.length > 0 ? bande : candidats;
  return meilleur(depart, retenus, direction)?.element;
}

describe("la fiche, bloc par bloc", () => {
  it("« bas » depuis Retour ne file plus à la tuile d'extras", () => {
    // Le défaut d'origine : la tuile chevauche Retour à l'horizontale, son
    // désalignement est nul, et la géométrie brute la préférait à toute la
    // rangée d'actions. La première bande sous Retour est « Voir plus » —
    // la zone élargie de la fiche redirigera ensuite vers « Lecture ».
    const candidats = nomme({
      voirPlus: VOIR_PLUS,
      lecture: LECTURE,
      maListe: MA_LISTE,
      extra1: EXTRA_1,
      saison1: SAISON_1,
      episode1: EPISODE_1,
    });
    expect(gagnant(RETOUR, candidats, "bas")).toBe("voirPlus");
  });

  it("« bas » depuis une pastille ronde s'arrête aux extras quand il y en a", () => {
    const candidats = nomme({
      extra1: EXTRA_1,
      extra4: EXTRA_4,
      saison1: SAISON_1,
      episode1: EPISODE_1,
    });
    expect(gagnant(MA_LISTE, candidats, "bas")).toBe("extra4");
  });

  it("sans extras, « bas » depuis une pastille ronde vise un onglet, jamais la ligne d'épisode", () => {
    // Une vraie rangée d'onglets s'arrête loin avant l'abscisse des
    // pastilles : son désalignement est payé ×3, et la ligne pleine largeur
    // l'enjambait. La bande des onglets est pourtant la première rencontrée.
    const candidats = nomme({
      saison1: SAISON_1,
      saison2: SAISON_2,
      saison3: SAISON_3,
      episode1: EPISODE_1,
    });
    expect(gagnant(MA_LISTE, candidats, "bas")).toBe("saison3");
  });

  it("« bas » depuis une tuile d'extras vise un onglet, jamais la ligne d'épisode", () => {
    const candidats = nomme({
      saison1: SAISON_1,
      saison2: SAISON_2,
      saison3: SAISON_3,
      episode1: EPISODE_1,
    });
    expect(gagnant(EXTRA_1, candidats, "bas")).toBe("saison1");
  });

  it("la remontée est symétrique : « haut » depuis un onglet vise les extras", () => {
    const candidats = nomme({
      voirPlus: VOIR_PLUS,
      lecture: LECTURE,
      extra1: EXTRA_1,
      extra4: EXTRA_4,
    });
    expect(gagnant(SAISON_1, candidats, "haut")).toBe("extra1");
  });

  it("sans bande dans la direction, le mouvement ne rend rien", () => {
    // Tout est au-dessus : la restriction rend vide, le repli géométrique
    // aussi — c'est le cas « bord de page », traité par le défilement.
    const candidats = nomme({ retour: RETOUR, lecture: LECTURE });
    expect(gagnant(EPISODE_1, candidats, "bas")).toBeUndefined();
  });
});
