/**
 * La largeur écrite en style EN LIGNE sur une carte.
 *
 * Point de passage unique des deux cartes de rangée — affiche et vignette
 * d'épisode. Quand la rangée a pu se caler, c'est sa mesure qui fait foi ;
 * sinon on retombe sur le `clamp(base, Xvw, lg)`, dont le débord de la carte
 * suivante est justement l'indice qu'il y a une suite à faire défiler.
 *
 * Extrait des deux composants pour une raison précise : un style en ligne
 * échappe aux passes PostCSS comme à la garde de compatibilité, et la cible
 * téléviseur ne peut pas se permettre un `clamp()` — Chrome 53 l'ignore, ce
 * qui n'invalide pas la valeur mais la DÉCLARATION ENTIÈRE. Il n'y a donc pas
 * de largeur du tout, et une carte en `width: auto` prend la largeur de son
 * titre. Isolé ici, ce repli se substitue ; noyé dans le JSX, il ne se
 * substituait pas.
 */

export interface CardWidths {
  base: number;
  lg: number;
}

export function cardWidthStyle(
  width: number | null | undefined,
  widths: CardWidths,
  vw: number,
): string {
  if (width != null) return `${width}px`;
  return `clamp(${widths.base}px, ${vw}vw, ${widths.lg}px)`;
}
