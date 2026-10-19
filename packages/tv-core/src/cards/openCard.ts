import type { CardSize } from "./cardSize";

/**
 * La carte qui S'OUVRE (Apple TV, Android TV — banc validé par Damien le
 * 19/10) : dans une rangée, la carte focalisée passe de l'affiche (2:3) à la
 * vignette (16:9) À LA MÊME HAUTEUR, posée au bord gauche du contenu ; les
 * cartes déjà passées s'effacent ; ses détails (raison, méta, résumé, « OK : …
 * · Maintenir OK ») s'écrivent dessous, et la bande-annonce se joue DEDANS.
 *
 * Une seule taille de carte pour TOUTES les pages (Accueil, Pour vous, Ma
 * liste, Mes favoris, bibliothèques) : le réglage « Taille des cartes » (ses
 * trois préréglages, `cardSize.ts`) la change partout à la fois. Petite = la
 * taille d'affiche d'avant ; Grande (le défaut) = celle du banc validé.
 *
 * La hauteur d'une rangée est FIXE : la place des détails est réservée dans
 * chaque rangée (la légende des affiches s'y écrit). Changer de focus ne remet
 * donc rien en page — seulement des transformations et des opacités.
 *
 * Module pur : les vues reçoivent les mesures, la scène fait 1920 × 1080.
 */

/** La hauteur d'une carte (affiche comme carte ouverte), par préréglage. */
export const OPEN_CARD_HEIGHT: Readonly<Record<CardSize, number>> = { small: 360, normal: 430, large: 500 };

/** Les mesures d'une rangée, hors cartes. */
export const OPEN_ROW = {
  /** Le titre de la rangée (36) et son écart (22). */
  titleHeight: 66,
  /** L'écart entre la carte et sa légende ou ses détails. */
  belowGap: 18,
  /** La place réservée aux détails : raison, méta, trois lignes de résumé, l'indice. */
  detailsHeight: 250,
  /** L'écart avant la rangée suivante. */
  rowGap: 52,
  /** L'écart entre deux cartes. */
  cardGap: 36,
} as const;

/** Les durées : l'ouverture et le glissement vont ensemble, les détails suivent. */
export const OPEN_CARD_MOTION = { openMs: 320, detailsInMs: 200, detailsDelayMs: 120, detailsOutMs: 120 } as const;

/** Une carte passée (à gauche de la carte ouverte) : presque effacée, toujours focalisable. */
export const OPEN_CARD_PAST_OPACITY = 0.06;

export interface OpenCardMetrics {
  size: CardSize;
  height: number;
  posterWidth: number;
  openWidth: number;
  posterRadius: number;
  openRadius: number;
  gap: number;
  /** Le pas d'une affiche dans la rangée (largeur + écart). */
  step: number;
  /** La hauteur FIXE d'une rangée, titre et place des détails compris. */
  rowHeight: number;
  /** Le haut des détails, depuis le haut de la rangée. */
  detailsTop: number;
}

export function openCardMetricsOf(size: CardSize): OpenCardMetrics {
  const height = OPEN_CARD_HEIGHT[size];
  const posterWidth = Math.round((height * 2) / 3);
  const openWidth = Math.round((height * 16) / 9);
  const detailsTop = OPEN_ROW.titleHeight + height + OPEN_ROW.belowGap;
  return {
    size,
    height,
    posterWidth,
    openWidth,
    posterRadius: 20,
    openRadius: 22,
    gap: OPEN_ROW.cardGap,
    step: posterWidth + OPEN_ROW.cardGap,
    rowHeight: detailsTop + OPEN_ROW.detailsHeight + OPEN_ROW.rowGap,
    detailsTop,
  };
}

/** Le décalage de la piste d'une rangée : la carte d'indice `index` se pose au bord gauche. */
export function openRowShift(index: number, m: OpenCardMetrics): number {
  return Math.max(0, index) * m.step;
}

/** Une carte de la rangée est-elle passée (à gauche de la carte ouverte) ? */
export function openCardIsPast(index: number, focusedIndex: number): boolean {
  return index < focusedIndex;
}

/** La place d'une carte dans sa piste : les affiches qui la précèdent, toutes fermées. */
export function openCardLeft(index: number, m: OpenCardMetrics): number {
  return index * m.step;
}
