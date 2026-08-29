import { isHorizontal, directionSign, type Direction } from "../input/keys";

/**
 * Choix du voisin, par la géométrie seule.
 *
 * Module pur : il ne connaît ni le DOM ni les événements, il ordonne des
 * rectangles. C'est ce qui le rend testable — et il a besoin de l'être, parce
 * qu'une navigation à la télécommande se juge sur des cas limites qu'on ne
 * reproduit pas à la main : deux cartes qui se chevauchent d'un pixel, une
 * rangée décalée, un bouton plus large que sa colonne.
 */

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
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
const MISALIGNMENT_WEIGHT = 3;

/**
 * Tolérance de départ, en pixels.
 *
 * Un candidat dont le bord dépasse de quelques pixels du côté d'où l'on vient
 * reste recevable : les cartes d'une même rangée ne sont pas toujours alignées
 * au pixel, et exiger un franchissement strict rendrait certaines
 * inatteignables.
 */
const TOLERANCE = 4;

/**
 * Un rectangle mesuré, quelle que soit la plateforme qui l'a mesuré.
 *
 * Décrit structurellement plutôt que par `DOMRect` : ce module doit tourner
 * aussi bien sous un navigateur que sous React Native, où `DOMRect` n'existe
 * pas. Un vrai `DOMRect` satisfait cette forme, donc la LG l'y passe
 * directement ; côté natif, `measureInWindow` fournit les mêmes quatre bords.
 */
export interface MeasuredRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function boxFromRect(rect: MeasuredRect): Box {
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
  };
}

/** Distance franchie dans la direction, du bord de départ au bord d'arrivée. */
function advance(from: Box, target: Box, direction: Direction): number {
  switch (direction) {
    case "droite":
      return target.left - from.right;
    case "gauche":
      return from.left - target.right;
    case "bas":
      return target.top - from.bottom;
    case "haut":
      return from.top - target.bottom;
  }
}

/**
 * Écart sur l'axe perpendiculaire.
 *
 * Nul tant que les projections se chevauchent : deux cartes d'une même rangée
 * qui n'ont pas exactement la même hauteur ne doivent pas être départagées
 * par cette différence.
 */
function misalignment(from: Box, target: Box, direction: Direction): number {
  const [startA, endA, startB, endB] = isHorizontal(direction)
    ? [from.top, from.bottom, target.top, target.bottom]
    : [from.left, from.right, target.left, target.right];

  if (endA >= startB && endB >= startA) return 0;
  return startB > endA ? startB - endA : startA - endB;
}

/**
 * Le candidat a-t-il réellement progressé malgré un chevauchement des boîtes ?
 *
 * Des marges négatives font se chevaucher des voisines de mise en page — les
 * lignes d'un menu de filtres se recouvrent de huit pixels, deux fois la
 * tolérance, parce que la passe d'écarts PostCSS pose `margin: -4px` sur
 * toute ligne qui est elle-même `flex gap-*`. Exiger un franchissement de
 * bord strict les rendait inatteignables : chaque « bas » sautait la voisine
 * pour la ligne d'après, et « haut », ne trouvant plus rien, refermait le
 * menu — condamnant tout ce qui précède l'option cochée.
 *
 * Deux conditions, cumulées : les boîtes ne sont PAS sur la même ligne (ou
 * colonne) visuelle — le juge par chevauchement de moitié, celui des grilles,
 * qui continue d'écarter ce qui est « au même endroit » — et le CENTRE du
 * candidat a franchi celui du départ dans la direction. Un voisin qui
 * chevauche reste ainsi un voisin ; un élément superposé reste écarté.
 */
function progressesDespiteOverlap(from: Box, target: Box, direction: Direction): boolean {
  const [onSameLane, fromCenter, targetCenter] = isHorizontal(direction)
    ? [onSameColumn(from, target), from.left + from.right, target.left + target.right]
    : [onSameRow(from, target), from.top + from.bottom, target.top + target.bottom];

  if (onSameLane) return false;
  return directionSign(direction) === 1 ? targetCenter > fromCenter : targetCenter < fromCenter;
}

/**
 * Score d'un candidat : plus il est bas, meilleur il est.
 * `null` quand le candidat n'est pas dans la direction demandée.
 */
export function scoreCandidate(from: Box, target: Box, direction: Direction): number | null {
  const distance = advance(from, target, direction);
  if (distance < -TOLERANCE && !progressesDespiteOverlap(from, target, direction)) return null;

  // Un candidat qui recouvre le point de départ sur l'axe de déplacement est
  // écarté : il est « au même endroit », le focus n'aurait pas l'air de bouger.
  if (covers(from, target, direction)) return null;

  return Math.max(distance, 0) + misalignment(from, target, direction) * MISALIGNMENT_WEIGHT;
}

/** Le candidat occupe-t-il la même place que le départ sur l'axe visé ? */
function covers(from: Box, target: Box, direction: Direction): boolean {
  const [fromStart, fromEnd, targetStart, targetEnd] = isHorizontal(direction)
    ? [from.left, from.right, target.left, target.right]
    : [from.top, from.bottom, target.top, target.bottom];

  return directionSign(direction) === 1
    ? targetStart < fromStart + TOLERANCE && targetEnd < fromEnd + TOLERANCE
    : targetEnd > fromEnd - TOLERANCE && targetStart > fromStart - TOLERANCE;
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
export function onSameRow(a: Box, b: Box): boolean {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (overlap <= 0) return false;
  const smallestHeight = Math.min(a.bottom - a.top, b.bottom - b.top);
  return overlap * 2 > smallestHeight;
}

/**
 * Deux boîtes sont-elles dans la même colonne visuelle ?
 *
 * Le miroir de `onSameRow`, pour le confinement VERTICAL d'une grille :
 * « bas » descend dans sa colonne, jamais en diagonale. Même formulation par
 * chevauchement — plus de la moitié de la plus petite des deux largeurs — et
 * pour la même raison : elle survit à l'agrandissement de la carte focalisée,
 * dont les flancs mordent la gouttière sans jamais recouvrir la moitié de la
 * colonne voisine.
 */
export function onSameColumn(a: Box, b: Box): boolean {
  const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  if (overlap <= 0) return false;
  const smallestWidth = Math.min(a.right - a.left, b.right - b.left);
  return overlap * 2 > smallestWidth;
}

/**
 * Ne garde que la première ligne rencontrée dans la direction.
 *
 * Le repli d'une colonne sans suite : la dernière rangée d'une grille est
 * rarement complète, et « bas » depuis une colonne orpheline doit atterrir sur
 * la rangée SUIVANTE — la carte la moins désalignée y fera l'affaire — mais
 * jamais deux rangées plus loin, ce que la géométrie brute produisait dès que
 * le score d'une carte lointaine mais alignée battait celui de la voisine.
 *
 * La ligne de référence est celle du candidat le plus proche dans la
 * direction ; tout ce qui n'est pas sur sa ligne est écarté.
 */
export function restrictToFirstRow<T>(
  from: Box,
  candidates: Array<{ element: T; box: Box }>,
  direction: Direction,
): Array<{ element: T; box: Box }> {
  let reference: Box | null = null;
  let smallestAdvance = Infinity;

  for (const candidate of candidates) {
    // La même acceptation que `noter` : une voisine chevauchante est la
    // première ligne, pas un candidat à sauter — sinon la bande de référence
    // serait la ligne d'APRÈS, et la restriction reproduirait le saut.
    const distance = advance(from, candidate.box, direction);
    if (distance < -TOLERANCE && !progressesDespiteOverlap(from, candidate.box, direction)) {
      continue;
    }
    if (covers(from, candidate.box, direction)) continue;
    if (distance < smallestAdvance) {
      smallestAdvance = distance;
      reference = candidate.box;
    }
  }

  if (!reference) return [];
  const row = reference;
  return candidates.filter((candidate) => onSameRow(row, candidate.box));
}

export interface ScoredCandidate<T> {
  element: T;
  score: number;
}

/** Le meilleur candidat, ou `null` si aucun n'est dans la direction. */
export function best<T>(
  from: Box,
  candidates: Array<{ element: T; box: Box }>,
  direction: Direction,
): ScoredCandidate<T> | null {
  let kept: ScoredCandidate<T> | null = null;

  for (const candidate of candidates) {
    const score = scoreCandidate(from, candidate.box, direction);
    if (score === null) continue;
    if (kept === null || score < kept.score) {
      kept = { element: candidate.element, score };
    }
  }

  return kept;
}
