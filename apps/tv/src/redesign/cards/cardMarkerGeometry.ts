import { formatCommunityRating, formatUserScore, type CardMarkers } from "@tentacle-tv/shared";
import { interTextWidth } from "../theme/interMetrics";

/**
 * La pastille de note d'une carte — celle que dessine `CardMarkerLayer`, en
 * bas à gauche de l'image —, et ce qui se pose au même endroit sans devoir la
 * croiser : le logo d'une vignette (`cardLogoBottom`), les badges de qualité
 * du focus, en bas à droite (`qualitySlot`).
 */
export const RATING_PILL = {
  height: 40,
  heightCompact: 34,
  /** Son pied, depuis le bas de l'image… */
  bottom: 12,
  /** …au-dessus de la barre de progression (6 px) quand la carte en porte une. */
  bottomAboveBar: 20,
  padding: 12,
  paddingCompact: 10,
  /** L'écart entre l'étoile, la note et la note perso. */
  gap: 8,
  gapCompact: 6,
  /** Le glyphe des marqueurs (épingles) ; l'étoile de la note en fait 2 de moins. */
  glyph: 22,
  glyphCompact: 18,
  /** La note (Inter Bold) et la note perso (Inter ExtraBold). */
  fontSize: 22,
  /** La capsule de la note perso : ses marges, son écart, son étoile (6 de moins que le glyphe). */
  user: { padding: 8, gap: 4, height: 28, starInset: 6 },
} as const;

/** Le retrait des pastilles depuis les bords de l'image. */
export const MARKER_INSET = 12;

/** Le cadre du logo d'une vignette : son retrait à gauche, à droite, sa hauteur. */
export const LOGO_BOX = { left: 22, right: 90, height: 64 } as const;

/** Le pied du logo quand rien ne l'occupe, et son écart à la pastille qu'il surplombe. */
const LOGO_BOTTOM = 22;
const LOGO_GAP = 12;
/** L'écart entre la note et les badges de qualité, sur la même rangée. */
const SLOT_GAP = 8;

/** La règle de `CardMarkerLayer` : une note globale ou perso à montrer. */
export function showsRating(markers: CardMarkers, hideRating = false): boolean {
  return !hideRating && (markers.communityRating !== null || markers.userScore !== null);
}

/** Le pied des pastilles du bas : au-dessus de la barre de progression quand il y en a une. */
function pillBottomOf(progress: number | undefined): number {
  return progress !== undefined ? RATING_PILL.bottomAboveBar : RATING_PILL.bottom;
}

/**
 * Le pied du logo d'une vignette (taille pleine), depuis le bas de l'image :
 * AU-DESSUS de la pastille de note quand la carte en montre une — rien ne
 * recouvre le logo —, à sa place basse sinon : il ne flotte pas pour rien.
 * La barre de progression remonte la pastille, et le logo avec elle.
 */
export function cardLogoBottom(markers: CardMarkers, progress: number | undefined): number {
  if (!showsRating(markers)) return LOGO_BOTTOM;
  return pillBottomOf(progress) + RATING_PILL.height + LOGO_GAP;
}

/** La largeur de la pastille de note telle que `CardMarkerLayer` la dessine. */
export function ratingPillWidth(markers: CardMarkers, compact: boolean): number {
  const R = RATING_PILL;
  const glyph = compact ? R.glyphCompact : R.glyph;
  const gap = compact ? R.gapCompact : R.gap;
  const parts: number[] = [];
  if (markers.communityRating !== null) {
    parts.push(glyph - 2, interTextWidth(formatCommunityRating(markers.communityRating), R.fontSize, "bold"));
  }
  if (markers.userScore !== null) {
    const score = interTextWidth(formatUserScore(markers.userScore), R.fontSize, "extrabold");
    parts.push(2 * R.user.padding + glyph - R.user.starInset + R.user.gap + score);
  }
  const content = parts.reduce((sum, part) => sum + part, 0) + gap * Math.max(0, parts.length - 1);
  return 2 * (compact ? R.paddingCompact : R.padding) + content;
}

/** La place des badges de qualité : leur pied, et leur largeur au plus. */
export interface QualitySlot {
  bottom: number;
  maxWidth: number;
}

/**
 * Les badges de qualité du focus, DANS l'image : en bas à droite, sur la
 * rangée de la note (au-dessus de la barre de progression), sans la croiser —
 * ni croiser le logo d'une vignette, quand il descend jusqu'à cette rangée
 * (pas de note : il est à sa place basse). Les épingles sont en haut : rien à
 * éviter de ce côté.
 */
export function qualitySlot(width: number, markers: CardMarkers, progress: number | undefined, compact: boolean, logo: boolean): QualitySlot {
  let left = MARKER_INSET;
  if (showsRating(markers)) left += ratingPillWidth(markers, compact) + SLOT_GAP;
  else if (logo) left = width - LOGO_BOX.right + SLOT_GAP;
  return { bottom: pillBottomOf(progress), maxWidth: Math.max(0, width - MARKER_INSET - left) };
}
