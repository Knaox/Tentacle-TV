import { onSameRow, type Box } from "./geometry";

/**
 * HAUT / BAS entre SECTIONS — la règle de voisinage verticale.
 *
 * Une page de téléviseur est une pile de SECTIONS : une rangée de cartes (son
 * titre et son accessoire compris), une ligne de grille, un réglage, l'en-tête
 * d'une fiche. Décidé avec l'utilisateur (2026-10-01) : HAUT ou BAS depuis un
 * élément d'une section atterrit TOUJOURS dans la section voisine, dès qu'elle
 * a un élément focalisable — sur celui dont le CENTRE est le plus proche,
 * horizontalement, du centre de l'élément qu'on quitte, même s'il n'est pas
 * sous lui. Jamais « rien ne se passe » quand quelque chose existe plus bas :
 * au bout d'un carrousel au-dessus d'une rangée plus courte, sur la dernière
 * ligne incomplète d'une grille, depuis un réglage décalé.
 *
 * DANS la section qu'on quitte d'abord : en descendant, sa ligne suivante
 * (des pastilles qui passent à la ligne, les cartes sous un en-tête), au plus
 * proche ; en remontant, seulement ce qui est à l'APLOMB — l'accessoire d'un
 * en-tête (la pastille du filtre de plateformes) se rejoint par HAUT depuis la
 * carte qui est dessous, sans être une étape obligée depuis le bout de la
 * rangée. On écrit dans le sens de la lecture : ce qui coiffe une section est
 * au-dessus, ce qui la prolonge, au-dessous. Une section qui se déclare
 * LISTE de lignes (`list` : un panneau de réglages) n'a rien qui la coiffe :
 * HAUT comme BAS y vont à la ligne voisine, au plus proche — le réglage un peu
 * trop à gauche de celui du dessus est atteint.
 *
 * Deux exceptions, tranchées le 2026-10-01 : une section peut déclarer son
 * ENTRÉE (`entry`), qui l'emporte quand elle est focalisable — l'onglet de la
 * saison affichée, toujours ; l'épisode à reprendre, à la première entrée
 * dans la rangée des épisodes. L'intégration la pose et la retire ; la règle
 * ne fait que la respecter.
 *
 * Module pur, comme `geometry.ts` dont il reprend la `Box` : la plateforme
 * mesure, la règle décide. Sur Apple TV, la traduction est NATIVE
 * (`apps/tv/ios/TentacleTV/TentacleFocusSection.m`) : la géométrie n'y est
 * juste qu'au moment même du geste — une rangée défile encore quand la flèche
 * part —, et seul le natif la lit sans aller-retour. Elle suit ce module pas à
 * pas ; ses tests sont le cahier des charges des deux.
 */

export type VerticalDirection = "haut" | "bas";

export interface SectionItem<T> {
  element: T;
  box: Box;
}

export interface SectionGeometry<T> {
  /** Le cadre de la section. */
  box: Box;
  /** Ses éléments focalisables. */
  items: Array<SectionItem<T>>;
  /** L'entrée déclarée : elle l'emporte quand elle figure parmi `items`. */
  entry?: T | null;
}

/**
 * Le chevauchement toléré entre deux sections empilées : une marge négative
 * (une affiche qui déborde au-dessus de sa rangée) ne doit pas faire d'une
 * voisine une section « à la même hauteur ». Plafonné au quart de la plus
 * petite des deux hauteurs : deux sections côte à côte restent écartées.
 */
const STACK_SLACK = 24;

/** Deux sections dont les bords visés sont à moins de ceci sont à égalité :
 *  côte à côte, on garde l'élément le plus proche des deux. */
const SAME_EDGE = 8;

/** Un élément est « dessus » un autre de sa section à ce jeu près. */
const FRONTIER_SLACK = 2;

const centerX = (box: Box) => (box.left + box.right) / 2;
const height = (box: Box) => box.bottom - box.top;
const overlapX = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left);

/** `to` est-elle au-delà de `from`, dans la direction ? */
export function isBeyond(from: Box, to: Box, direction: VerticalDirection): boolean {
  const slack = Math.min(STACK_SLACK, Math.min(height(from), height(to)) / 4);
  return direction === "bas" ? to.top >= from.bottom - slack : to.bottom <= from.top + slack;
}

/**
 * Les sections voisines de `from` dans la direction : la plus proche qui a un
 * élément, et celles qui sont à sa hauteur (côte à côte). Une section qui ne
 * partage aucune abscisse avec `from` est dans une autre colonne : écartée.
 */
export function adjacentSections<T>(from: Box, sections: Array<SectionGeometry<T>>, direction: VerticalDirection): Array<SectionGeometry<T>> {
  const edge = (section: SectionGeometry<T>) => (direction === "bas" ? section.box.top : -section.box.bottom);
  const beyond = sections.filter(
    (section) => section.items.length > 0 && overlapX(from, section.box) > 0 && isBeyond(from, section.box, direction),
  );
  if (beyond.length === 0) return [];
  const nearest = Math.min(...beyond.map(edge));
  return beyond.filter((section) => edge(section) - nearest <= SAME_EDGE);
}

/**
 * Ce qu'une section présente du côté d'où l'on arrive : en descendant, ses
 * éléments qui n'ont rien de leur section au-dessus d'eux dans leur colonne —
 * sa première ligne, la pastille d'un en-tête et les cartes qui ne sont pas
 * sous elle ; en remontant, le miroir. La dernière ligne incomplète d'une
 * grille ne cache donc pas les colonnes qu'elle n'a pas.
 */
export function facingItems<T>(section: SectionGeometry<T>, direction: VerticalDirection): Array<SectionItem<T>> {
  return section.items.filter(
    (item) =>
      !section.items.some(
        (other) =>
          other !== item &&
          overlapX(item.box, other.box) > 0 &&
          (direction === "bas" ? other.box.bottom <= item.box.top + FRONTIER_SLACK : other.box.top >= item.box.bottom - FRONTIER_SLACK),
      ),
  );
}

/** L'élément dont le centre est le plus proche, horizontalement, de celui de
 *  `from` ; à égalité, le moins loin dans la direction, puis le plus à gauche. */
export function nearestByCenter<T>(from: Box, items: Array<SectionItem<T>>, direction: VerticalDirection): SectionItem<T> | null {
  const target = centerX(from);
  const advance = (box: Box) => (direction === "bas" ? box.top - from.bottom : from.top - box.bottom);
  let kept: SectionItem<T> | null = null;
  for (const item of items) {
    if (kept === null) {
      kept = item;
      continue;
    }
    const gap = Math.abs(centerX(item.box) - target) - Math.abs(centerX(kept.box) - target);
    if (gap < -0.5) kept = item;
    else if (gap <= 0.5) {
      const further = advance(item.box) - advance(kept.box);
      if (further < -0.5 || (further <= 0.5 && item.box.left < kept.box.left)) kept = item;
    }
  }
  return kept;
}

/**
 * Dans la section qu'on quitte : ses éléments au-delà de `from` — en
 * remontant, à l'aplomb seulement, sauf dans une liste — ; la ligne la plus
 * proche (ce qui partage la hauteur de l'élément le plus proche : des
 * contrôles de tailles différentes, centrés, sont sur la même ligne), puis
 * le centre.
 */
export function inLineWithin<T>(from: Box, siblings: Array<SectionItem<T>>, direction: VerticalDirection, list = false): SectionItem<T> | null {
  const advance = (box: Box) => (direction === "bas" ? box.top - from.bottom : from.top - box.bottom);
  const inAxis = (box: Box) => list || direction === "bas" || overlapX(from, box) > 0;
  const beyond = siblings.filter((item) => inAxis(item.box) && advance(item.box) >= -FRONTIER_SLACK);
  if (beyond.length === 0) return null;
  let closest = beyond[0];
  for (const item of beyond) if (advance(item.box) < advance(closest.box)) closest = item;
  return nearestByCenter(from, beyond.filter((item) => onSameRow(closest.box, item.box)), direction);
}

/**
 * La règle entière : depuis l'élément `item` de la section `section` (dont
 * `siblings` sont les autres éléments, `list` sa nature), HAUT ou BAS. Rend
 * l'élément visé, ou `null` quand rien n'est au-delà — la plateforme garde
 * alors son comportement (un guide, un bord).
 */
export function pickSectionNeighbor<T>(
  from: { section: Box; item: Box; siblings?: Array<SectionItem<T>>; list?: boolean },
  sections: Array<SectionGeometry<T>>,
  direction: VerticalDirection,
): T | null {
  const within = inLineWithin(from.item, from.siblings ?? [], direction, from.list);
  if (within) return within.element;
  let kept: { section: SectionGeometry<T>; item: SectionItem<T> } | null = null;
  for (const section of adjacentSections(from.section, sections, direction)) {
    const item = nearestByCenter(from.item, facingItems(section, direction), direction);
    if (!item) continue;
    const better: SectionItem<T> | null = kept === null ? null : nearestByCenter(from.item, [kept.item, item], direction);
    if (kept === null || better === item) kept = { section, item };
  }
  if (!kept) return null;
  const { entry } = kept.section;
  if (entry != null && kept.section.items.some((candidate) => candidate.element === entry)) return entry;
  return kept.item.element;
}
