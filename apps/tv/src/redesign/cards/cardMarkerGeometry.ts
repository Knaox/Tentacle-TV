import type { CardMarkers } from "@tentacle-tv/shared";

/**
 * La pastille de note d'une carte — celle que dessine `CardMarkerLayer`, en
 * bas à gauche de l'image —, et ce qui se pose au même endroit sans devoir la
 * croiser : le logo d'une vignette (`cardLogoBottom`).
 */
export const RATING_PILL = {
  height: 40,
  heightCompact: 34,
  /** Son pied, depuis le bas de l'image… */
  bottom: 12,
  /** …au-dessus de la barre de progression (6 px) quand la carte en porte une. */
  bottomAboveBar: 20,
} as const;

/** Le pied du logo quand rien ne l'occupe, et son écart à la pastille qu'il surplombe. */
const LOGO_BOTTOM = 22;
const LOGO_GAP = 12;

/** La règle de `CardMarkerLayer` : une note globale ou perso à montrer. */
export function showsRating(markers: CardMarkers, hideRating = false): boolean {
  return !hideRating && (markers.communityRating !== null || markers.userScore !== null);
}

/**
 * Le pied du logo d'une vignette (taille pleine), depuis le bas de l'image :
 * AU-DESSUS de la pastille de note quand la carte en montre une — rien ne
 * recouvre le logo —, à sa place basse sinon : il ne flotte pas pour rien.
 * La barre de progression remonte la pastille, et le logo avec elle.
 */
export function cardLogoBottom(markers: CardMarkers, progress: number | undefined): number {
  if (!showsRating(markers)) return LOGO_BOTTOM;
  const pillBottom = progress !== undefined ? RATING_PILL.bottomAboveBar : RATING_PILL.bottom;
  return pillBottom + RATING_PILL.height + LOGO_GAP;
}
