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

/**
 * Une carte passée (à gauche de la carte ouverte) : effacée comme au banc, mais
 * toujours focalisable — tvOS ne focalise plus une vue d'opacité 0,01 ou moins
 * (GAUCHE ne la trouverait pas) ; 0,02 ne se voit plus (mesuré au simulateur
 * le 19/10 : 0,06 laissait un fantôme sous le rail).
 */
export const OPEN_CARD_PAST_OPACITY = 0.02;

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

/**
 * La PAGE à cartes qui s'ouvrent (scène 1920 × 1080) : la rangée focalisée se
 * pose TOUJOURS à `anchorTop` (la page défile seule, en un mouvement) ; la
 * bannière, en haut de la page, la page au début.
 */
export const OPEN_PAGE = {
  anchorTop: 56,
  heroTop: 48,
  heroHeight: 520,
  heroGap: 56,
  heroRadius: 28,
  /** La marge sûre de droite. */
  safeRight: 96,
  width: 1920,
  height: 1080,
} as const;

/** Où la page pose une rangée qui prend le focus (`FocusSection reveal`). */
export const OPEN_ROW_REVEAL = { mode: "anchor", top: OPEN_PAGE.anchorTop } as const;

export interface OpenStageRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/**
 * Les rectangles de la SCÈNE (le lecteur unique, posé derrière la page) : la
 * carte ouverte — toujours au même endroit, sa rangée à l'ancrage, elle au bord
 * gauche — et la bannière focalisée (la page au début).
 */
export function openStageRects(m: OpenCardMetrics, inset: number): { card: OpenStageRect; hero: OpenStageRect } {
  return {
    card: { x: inset, y: OPEN_PAGE.anchorTop + OPEN_ROW.titleHeight, width: m.openWidth, height: m.height, radius: m.openRadius },
    hero: {
      x: inset,
      y: OPEN_PAGE.heroTop,
      width: OPEN_PAGE.width - inset - OPEN_PAGE.safeRight,
      height: OPEN_PAGE.heroHeight,
      radius: OPEN_PAGE.heroRadius,
    },
  };
}

/** La marge du bas de la page : de quoi poser sa DERNIÈRE rangée à l'ancrage, comme les autres. */
export function openPageBottomRoom(m: OpenCardMetrics): number {
  return Math.max(0, OPEN_PAGE.height - OPEN_PAGE.anchorTop - m.rowHeight);
}

/**
 * L'ENTRÉE d'une rangée qui s'ouvre, depuis une section voisine (HAUT / BAS) :
 * la carte posée au RETRAIT de la rangée — celle qu'elle montre ouverte au
 * bord gauche, la dernière focalisée —, jamais celle qui se trouve sous
 * l'élément quitté (la bannière est large : son centre tombait sur la 3e
 * carte, relevé au simulateur le 19/10). `lefts` : le bord gauche de chaque
 * élément de la rangée, à l'écran ; `retrait` : celui de la rangée. -1 : vide.
 * Appliquée par les sections natives (`TentacleFocusNeighbors.m`,
 * `FocusNeighbors.kt`), à défaut d'entrée déclarée.
 */
export function openRowEntry(lefts: readonly number[], retrait: number): number {
  let best = -1;
  for (let i = 0; i < lefts.length; i++) {
    if (best < 0 || Math.abs(lefts[i] - retrait) < Math.abs(lefts[best] - retrait)) best = i;
  }
  return best;
}

/**
 * Ce qu'une rangée qui s'ouvre MONTE de ses cartes : sa tête (ce qui tient à
 * l'écran depuis le retrait, `head`), puis, quand le focus avance, jusqu'à
 * `aheadCards` au-delà de lui — par paquets de `chunk`, pour ne pas redessiner
 * la rangée à chaque pas. Une bibliothèque a une vingtaine de rangées de 24
 * cartes : toutes montées, BAS ×6 créait 3 200 vues et le fil JS tombait à
 * 14 i/s (banc de fluidité, 19/10).
 */
export const OPEN_ROW_MOUNT = { aheadCards: 4, chunk: 8 } as const;

/** Les cartes à monter, le focus sur `focusedIndex` (-1 : aucun) ; jamais moins que déjà monté. */
export function openRowMounted(mounted: number, head: number, focusedIndex: number, total: number): number {
  const need = Math.max(head, focusedIndex + 1 + OPEN_ROW_MOUNT.aheadCards);
  if (need <= mounted) return Math.min(mounted, total);
  // Sous la tête (l'arrivée), la tête ; au-delà, un paquet au moins.
  return Math.min(total, mounted < head ? need : Math.max(need, mounted + OPEN_ROW_MOUNT.chunk));
}

/** La tête d'une rangée qui s'ouvre : les affiches qui tiennent à l'écran depuis son retrait, et la suivante. */
export function openRowHead(m: OpenCardMetrics, inset: number): number {
  return Math.ceil((OPEN_PAGE.width - inset) / m.step) + 1;
}
