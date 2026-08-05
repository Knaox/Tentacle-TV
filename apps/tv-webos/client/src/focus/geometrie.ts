import { estHorizontale, sens, type Direction } from "./touches";

/**
 * Choix du voisin, par la géométrie seule.
 *
 * Module pur : il ne connaît ni le DOM ni les événements, il ordonne des
 * rectangles. C'est ce qui le rend testable — et il a besoin de l'être, parce
 * qu'une navigation à la télécommande se juge sur des cas limites qu'on ne
 * reproduit pas à la main : deux cartes qui se chevauchent d'un pixel, une
 * rangée décalée, un bouton plus large que sa colonne.
 */

export interface Boite {
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
}

/**
 * Poids du désalignement.
 *
 * Un candidat parfaitement aligné mais lointain doit l'emporter sur un
 * candidat proche mais décalé : sur une grille d'affiches, « bas » doit
 * descendre dans la même colonne, pas partir en diagonale vers la carte dont
 * le coin se trouve être le plus proche. Trois est le rapport à partir duquel
 * le déplacement cesse d'être ressenti comme aléatoire.
 */
const POIDS_DESALIGNEMENT = 3;

/**
 * Tolérance de départ, en pixels.
 *
 * Un candidat dont le bord dépasse de quelques pixels du côté d'où l'on vient
 * reste recevable : les cartes d'une même rangée ne sont pas toujours alignées
 * au pixel, et exiger un franchissement strict rendrait certaines
 * inatteignables.
 */
const TOLERANCE = 4;

export function boiteDepuisRectangle(rectangle: DOMRect): Boite {
  return {
    gauche: rectangle.left,
    droite: rectangle.right,
    haut: rectangle.top,
    bas: rectangle.bottom,
  };
}

/** Distance franchie dans la direction, du bord de départ au bord d'arrivée. */
function avance(depart: Boite, cible: Boite, direction: Direction): number {
  switch (direction) {
    case "droite":
      return cible.gauche - depart.droite;
    case "gauche":
      return depart.gauche - cible.droite;
    case "bas":
      return cible.haut - depart.bas;
    case "haut":
      return depart.haut - cible.bas;
  }
}

/**
 * Écart sur l'axe perpendiculaire.
 *
 * Nul tant que les projections se chevauchent : deux cartes d'une même rangée
 * qui n'ont pas exactement la même hauteur ne doivent pas être départagées
 * par cette différence.
 */
function desalignement(depart: Boite, cible: Boite, direction: Direction): number {
  const [debutA, finA, debutB, finB] = estHorizontale(direction)
    ? [depart.haut, depart.bas, cible.haut, cible.bas]
    : [depart.gauche, depart.droite, cible.gauche, cible.droite];

  if (finA >= debutB && finB >= debutA) return 0;
  return debutB > finA ? debutB - finA : debutA - finB;
}

/**
 * Score d'un candidat : plus il est bas, meilleur il est.
 * `null` quand le candidat n'est pas dans la direction demandée.
 */
export function noter(depart: Boite, cible: Boite, direction: Direction): number | null {
  const distance = avance(depart, cible, direction);
  if (distance < -TOLERANCE) return null;

  // Un candidat qui recouvre le point de départ sur l'axe de déplacement est
  // écarté : il est « au même endroit », le focus n'aurait pas l'air de bouger.
  if (recouvre(depart, cible, direction)) return null;

  return Math.max(distance, 0) + desalignement(depart, cible, direction) * POIDS_DESALIGNEMENT;
}

/** Le candidat occupe-t-il la même place que le départ sur l'axe visé ? */
function recouvre(depart: Boite, cible: Boite, direction: Direction): boolean {
  const [departDebut, departFin, cibleDebut, cibleFin] = estHorizontale(direction)
    ? [depart.gauche, depart.droite, cible.gauche, cible.droite]
    : [depart.haut, depart.bas, cible.haut, cible.bas];

  return sens(direction) === 1
    ? cibleDebut < departDebut + TOLERANCE && cibleFin < departFin + TOLERANCE
    : cibleFin > departFin - TOLERANCE && cibleDebut > departDebut - TOLERANCE;
}

/**
 * Deux boîtes sont-elles sur la même ligne visuelle ?
 *
 * Sert au confinement horizontal d'une grille : « droite » depuis la dernière
 * carte d'une ligne ne doit pas descendre en diagonale sur la première de la
 * suivante. Une piste horizontale se reconnaît à son conteneur, une ligne de
 * grille n'a rien qui la désigne — seules les ordonnées la définissent.
 *
 * **Ce n'est pas une comparaison de bords, et l'avoir cru rendait les grilles
 * impilotables.** La version précédente exigeait des bords hauts distants de
 * quatre pixels au plus. Or la carte qui porte le focus est AGRANDIE, et un
 * `scale()` centré remonte son bord haut de la moitié de ce qu'il ajoute :
 * mesuré sur une bibliothèque, la carte visée était à `haut = −26` quand ses
 * voisines restaient à `0`. Plus aucune n'était « sur la même ligne », la liste
 * de candidats devenait vide, et **gauche et droite ne faisaient plus rien** —
 * on se retrouvait prisonnier d'une colonne, seuls haut et bas répondant.
 *
 * On teste donc un CHEVAUCHEMENT : deux boîtes sont sur la même ligne quand
 * elles partagent plus de la moitié de la plus petite des deux hauteurs. Cette
 * formulation survit à l'agrandissement, qui ne fait que grandir un
 * chevauchement déjà total, et elle garde ce que la comparaison de bords
 * cherchait à protéger — deux cartes de hauteurs différentes, parce qu'un titre
 * passe sur deux lignes, restent sur la même ligne. Aucun seuil arbitraire :
 * la moitié d'une hauteur est une quantité que la mise en page fournit
 * elle-même, là où quatre pixels étaient un pari sur le rendu.
 */
export function surLaMemeLigne(a: Boite, b: Boite): boolean {
  const chevauchement = Math.min(a.bas, b.bas) - Math.max(a.haut, b.haut);
  if (chevauchement <= 0) return false;
  const plusPetiteHauteur = Math.min(a.bas - a.haut, b.bas - b.haut);
  return chevauchement * 2 > plusPetiteHauteur;
}

export interface CandidatNote<T> {
  element: T;
  score: number;
}

/** Le meilleur candidat, ou `null` si aucun n'est dans la direction. */
export function meilleur<T>(
  depart: Boite,
  candidats: Array<{ element: T; boite: Boite }>,
  direction: Direction,
): CandidatNote<T> | null {
  let retenu: CandidatNote<T> | null = null;

  for (const candidat of candidats) {
    const score = noter(depart, candidat.boite, direction);
    if (score === null) continue;
    if (retenu === null || score < retenu.score) {
      retenu = { element: candidat.element, score };
    }
  }

  return retenu;
}
