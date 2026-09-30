/**
 * Les gabarits du plateau, en points 1080p — le `TRAY_SIZE` du bureau, à trois
 * mètres. Un bouton a une LARGEUR, jamais une hauteur fixe : sur une affiche
 * étroite, tous les boutons se resserrent ensemble au lieu de déborder de la
 * carte, avec un plancher qui garde deux centres à 24 points au moins
 * (l'exception d'espacement de WCAG 2.5.8, comme au bureau). Cinq boutons au
 * plus (`cardTrayEntries`) : sur l'affiche la plus étroite de la scène — la
 * carte qui se redresse, 220 —, ils gardent 36 points chacun.
 */

export type TrayFace = "poster" | "landscape";

export const TRAY = {
  /** Le bouton, à son aise. */
  button: 44,
  /** Plancher : avec l'écart de 4, deux centres restent à 24 au moins. */
  minButton: 20,
  gap: 4,
  /** Le liseré intérieur de la capsule (son `padding`), et son bord. */
  pad: 4,
  border: 1,
  /** De la capsule au bord de la carte — 4 px sur une affiche du bureau. */
  inset: { poster: 6, landscape: 12 },
  /** Le pied du groupe, au-dessus de la barre de progression (6). */
  bottom: { poster: 10, landscape: 12 },
  /** Une étoile : jamais plus grande qu'un bouton. */
  maxStar: 40,
  /** Entre la bulle, les étoiles et la capsule. */
  rowGap: 6,
} as const;

/** La taille des boutons d'un plateau de `count` boutons, sur une carte de `width`. */
export function trayButtonSize(face: TrayFace, width: number, count: number): number {
  const n = Math.max(1, count);
  const room = width - 2 * (TRAY.inset[face] + TRAY.pad + TRAY.border) - (n - 1) * TRAY.gap;
  return Math.max(TRAY.minButton, Math.min(TRAY.button, Math.floor(room / n)));
}

/** La taille d'une étoile, à côté de boutons de `button`. */
export function trayStarSize(button: number): number {
  return Math.min(button, TRAY.maxStar);
}

/**
 * Ce que le plateau occupe de focalisable, depuis le pied de la carte (au
 * repos, avant l'agrandissement) : la capsule et les étoiles — pas la bulle,
 * qui ne se focalise pas. La carte focalisable s'arrête au-dessus : elle ne
 * recouvre jamais un bouton de son plateau (sur tvOS, un focalisable recouvert
 * n'est plus proposé au focus). L'agrandissement ne fait que les descendre.
 */
export function trayReach(face: TrayFace, width: number, count: number, rated: boolean): number {
  const button = trayButtonSize(face, width, count);
  const capsule = count > 0 ? button + 2 * (TRAY.pad + TRAY.border) : 0;
  const stars = rated ? trayStarSize(button) : 0;
  return TRAY.bottom[face] + capsule + (capsule > 0 && stars > 0 ? TRAY.rowGap : 0) + stars;
}

/** Le glyphe d'un bouton : la moitié du rond au bureau, un peu plus à trois mètres. */
export function trayGlyphSize(button: number): number {
  return Math.max(18, Math.round(button * 0.54));
}
