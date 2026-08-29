import { describe, expect, it } from "vitest";
import { best, restrictToFirstRow, type Box } from "./geometry";
import type { Direction } from "../input/keys";

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

function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, right: left + width, bottom: top + height };
}

const RETOUR = box(72, 40, 95, 46);
const VOIR_PLUS = box(304, 464, 70, 24);
const PLAY = box(304, 501, 181, 56);
const MY_LIST = box(715, 501, 56, 56);
const EXTRA_1 = box(56, 677, 208, 117);
const EXTRA_4 = box(728, 677, 208, 117);
const SAISON_1 = box(32, 947, 106, 42);
const SAISON_2 = box(150, 947, 110, 42);
const SAISON_3 = box(272, 947, 110, 42);
const EPISODE_1 = box(32, 1017, 1216, 125);

function named(entries: Record<string, Box>) {
  return Object.entries(entries).map(([element, elementBox]) => ({
    element,
    box: elementBox,
  }));
}

function winner(from: Box, candidates: Array<{ element: string; box: Box }>, direction: Direction) {
  const band = restrictToFirstRow(from, candidates, direction);
  const kept = band.length > 0 ? band : candidates;
  return best(from, kept, direction)?.element;
}

describe("la fiche, bloc par bloc", () => {
  it("« bas » depuis Retour ne file plus à la tuile d'extras", () => {
    // Le défaut d'origine : la tuile chevauche Retour à l'horizontale, son
    // désalignement est nul, et la géométrie brute la préférait à toute la
    // rangée d'actions. La première bande sous Retour est « Voir plus » —
    // la zone élargie de la fiche redirigera ensuite vers « Lecture ».
    const candidates = named({
      voirPlus: VOIR_PLUS,
      lecture: PLAY,
      maListe: MY_LIST,
      extra1: EXTRA_1,
      saison1: SAISON_1,
      episode1: EPISODE_1,
    });
    expect(winner(RETOUR, candidates, "bas")).toBe("voirPlus");
  });

  it("« bas » depuis une pastille ronde s'arrête aux extras quand il y en a", () => {
    const candidates = named({
      extra1: EXTRA_1,
      extra4: EXTRA_4,
      saison1: SAISON_1,
      episode1: EPISODE_1,
    });
    expect(winner(MY_LIST, candidates, "bas")).toBe("extra4");
  });

  it("sans extras, « bas » depuis une pastille ronde vise un onglet, jamais la ligne d'épisode", () => {
    // Une vraie rangée d'onglets s'arrête loin avant l'abscisse des
    // pastilles : son désalignement est payé ×3, et la ligne pleine largeur
    // l'enjambait. La bande des onglets est pourtant la première rencontrée.
    const candidates = named({
      saison1: SAISON_1,
      saison2: SAISON_2,
      saison3: SAISON_3,
      episode1: EPISODE_1,
    });
    expect(winner(MY_LIST, candidates, "bas")).toBe("saison3");
  });

  it("« bas » depuis une tuile d'extras vise un onglet, jamais la ligne d'épisode", () => {
    const candidates = named({
      saison1: SAISON_1,
      saison2: SAISON_2,
      saison3: SAISON_3,
      episode1: EPISODE_1,
    });
    expect(winner(EXTRA_1, candidates, "bas")).toBe("saison1");
  });

  it("la remontée est symétrique : « haut » depuis un onglet vise les extras", () => {
    const candidates = named({
      voirPlus: VOIR_PLUS,
      lecture: PLAY,
      extra1: EXTRA_1,
      extra4: EXTRA_4,
    });
    expect(winner(SAISON_1, candidates, "haut")).toBe("extra1");
  });

  it("sans bande dans la direction, le mouvement ne rend rien", () => {
    // Tout est au-dessus : la restriction rend vide, le repli géométrique
    // aussi — c'est le cas « bord de page », traité par le défilement.
    const candidates = named({ retour: RETOUR, lecture: PLAY });
    expect(winner(EPISODE_1, candidates, "bas")).toBeUndefined();
  });
});
