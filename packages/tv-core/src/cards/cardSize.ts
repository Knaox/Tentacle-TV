/**
 * La taille des cartes des téléviseurs — un réglage d'APPAREIL (Réglages ›
 * Apparence, Apple TV et Android TV) : Petite, Normale, Grande.
 *
 * « Normale » est la taille d'avant le réglage, à l'identique. « Grande » est
 * la taille Netflix — un peu plus de trois vignettes par rangée — et le DÉFAUT
 * depuis le 16/10 (choix de Damien) : un téléviseur qui n'a jamais choisi passe
 * en Grande, celui qui a choisi garde son choix (la clé n'est écrite qu'à un
 * choix). « Petite », un peu plus petite, pas trop — près de cinq vignettes.
 *
 * La règle tient en un facteur appliqué aux gabarits de la scène (vignette
 * 16:9, affiche 2:3) ; les grilles, elles, changent de nombre de colonnes —
 * la largeur d'une affiche y suit celle de la grille. Module pur : les vues
 * reçoivent le résultat (`cardMetricsOf`), elles ne lisent aucun stockage.
 */

export type CardSize = "small" | "normal" | "large";

/** L'ordre du réglage, du plus petit au plus grand. */
export const CARD_SIZES: readonly CardSize[] = ["small", "normal", "large"];

export const DEFAULT_CARD_SIZE: CardSize = "large";

/** La clé de stockage (traversée par une chaîne : ne jamais la renommer). */
export const CARD_SIZE_STORAGE_KEY = "tentacle_tv_card_size";

/** Le facteur appliqué aux gabarits des rangées. */
export const CARD_SIZE_SCALE: Readonly<Record<CardSize, number>> = {
  small: 0.85,
  normal: 1,
  large: 1.3,
};

/** Les colonnes d'une grille d'affiches (bibliothèque, collection, parcours). */
export const CARD_SIZE_GRID_COLUMNS: Readonly<Record<CardSize, number>> = {
  small: 7,
  normal: 6,
  large: 5,
};

/** Une valeur lue du stockage → une taille connue, sinon la taille par défaut. */
export function parseCardSize(raw: string | null | undefined): CardSize {
  return raw === "small" || raw === "large" || raw === "normal" ? raw : DEFAULT_CARD_SIZE;
}

export interface CardFrameSize {
  width: number;
  height: number;
  radius: number;
}

/** Les gabarits de base — ceux de la scène (`TV_STAGE.card`), taille normale. */
export interface CardBaseMetrics {
  landscape: CardFrameSize;
  poster: CardFrameSize;
}

export interface CardMetrics extends CardBaseMetrics {
  size: CardSize;
  scale: number;
  gridColumns: number;
}

function scaled(frame: CardFrameSize, scale: number, ratio: number): CardFrameSize {
  if (scale === 1) return frame;
  const width = Math.round(frame.width * scale);
  // La hauteur suit le format (16:9, 2:3), jamais un arrondi propre à elle.
  return { width, height: Math.round(width * ratio), radius: Math.round(frame.radius * Math.min(scale, 1.15)) };
}

/** Les gabarits des cartes à la taille `size`. Normale : les gabarits de base, tels quels. */
export function cardMetricsOf(size: CardSize, base: CardBaseMetrics): CardMetrics {
  const scale = CARD_SIZE_SCALE[size];
  return {
    size,
    scale,
    gridColumns: CARD_SIZE_GRID_COLUMNS[size],
    landscape: scaled(base.landscape, scale, 9 / 16),
    poster: scaled(base.poster, scale, 3 / 2),
  };
}

export interface CardArtworkPixels {
  landscapeWidth: number;
  posterHeight: number;
}

/**
 * Les pixels des images des cartes à demander au serveur pour la taille
 * `size` : ceux du profil de rendu, agrandis avec la carte (une grande carte
 * reste nette), jamais réduits — une petite carte garde la même image, déjà
 * en cache.
 */
export function cardArtworkFor(base: CardArtworkPixels, size: CardSize): CardArtworkPixels {
  const scale = Math.max(1, CARD_SIZE_SCALE[size]);
  if (scale === 1) return base;
  return { landscapeWidth: Math.ceil(base.landscapeWidth * scale), posterHeight: Math.ceil(base.posterHeight * scale) };
}
