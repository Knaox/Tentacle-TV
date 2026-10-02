/**
 * La SUITE DE FICHES d'une télévision — module pur : ni React, ni navigation.
 *
 * Une page de détail — la fiche d'un titre (film, série, épisode, saga), la
 * page d'une personne — ouverte DEPUIS une autre page de détail la REMPLACE
 * dans la pile : un titre similaire, puis un autre, puis un autre… et un seul
 * Retour ramène là où l'on était avant la première fiche, le focus rendu à
 * la carte d'origine. La pile ne garde pas une suite de fiches et leurs
 * images (décidé le 2026-10-02, après un essai : il fallait autant de Retour
 * que de fiches traversées).
 *
 * Deux exceptions, la hiérarchie d'une série :
 * - DESCENDRE d'une série (ou d'une saison) vers l'une de ses saisons ou de
 *   ses épisodes EMPILE, comme avant : Retour y remonte ;
 * - la page visée est celle juste DESSOUS (l'épisode ouvert depuis sa série
 *   qui remonte à sa série) : on y RECULE, au lieu d'en empiler une seconde.
 *
 * Depuis une page qui n'est pas une fiche (accueil, bibliothèque,
 * recherche…), on empile : c'est la première fiche de la suite.
 */

/** Une page de la pile, vue d'ici : une fiche, la page d'une personne, ou autre chose. */
export type DetailPage =
  | { kind: "title"; id: string }
  | { kind: "person"; id: string }
  | null;

/** La page de détail à ouvrir. */
export interface DetailTarget {
  kind: "title" | "person";
  id: string;
  /** Un épisode ou une saison : sa série. */
  seriesId?: string | null;
  /** Un épisode : sa saison. */
  seasonId?: string | null;
}

/** Empiler (`push`), remplacer la page courante (`replace`), reculer d'une
 *  page (`back`), ou rien : on y est déjà (`stay`). */
export type DetailMove = "push" | "replace" | "back" | "stay";

const samePage = (page: DetailPage, target: DetailTarget): boolean =>
  page !== null && page.kind === target.kind && page.id === target.id;

export function detailMove(from: DetailPage, target: DetailTarget, below: DetailPage): DetailMove {
  if (from === null) return "push";
  if (samePage(from, target)) return "stay";
  if (samePage(below, target)) return "back";
  const child = from.kind === "title" && target.kind === "title"
    && (target.seriesId === from.id || target.seasonId === from.id);
  return child ? "push" : "replace";
}
