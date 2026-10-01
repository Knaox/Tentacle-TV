/**
 * La COLONNE du rail : un bloc (les pages) qui épouse son contenu, CENTRÉ sur
 * la hauteur de l'écran, au-dessus d'un bloc ancré en bas (le profil, et ce
 * qui s'y ajoute). Le bloc du bas ne bouge jamais et n'est jamais caché :
 * c'est celui du haut qui cède — il remonte d'abord, garde l'écart, puis
 * rétrécit (sa liste défile), sans jamais dépasser sa hauteur permise.
 *
 * Module pur : la géométrie arrive en argument (points).
 */

export interface RailColumnSpec {
  /** La hauteur de l'écran. */
  screen: number;
  marginTop: number;
  marginBottom: number;
  /** L'écart minimal entre les deux blocs. */
  gap: number;
  /** La hauteur que le bloc du haut voudrait : toutes ses entrées. */
  wanted: number;
  /** Sa hauteur permise au plus. */
  max: number;
  /** La hauteur du bloc du bas. */
  bottom: number;
}

export interface RailColumn {
  /** Le bloc du haut : son haut, sa hauteur. */
  top: number;
  height: number;
  /** Le haut du bloc du bas. */
  bottomTop: number;
}

export function railColumn({ screen, marginTop, marginBottom, gap, wanted, max, bottom }: RailColumnSpec): RailColumn {
  const bottomTop = screen - marginBottom - bottom;
  const floor = bottomTop - gap;
  const height = Math.max(0, Math.min(wanted, max, floor - marginTop));
  // Centré, sinon remonté jusqu'à l'écart — jamais au-dessus de la marge haute.
  const top = Math.max(marginTop, Math.min(Math.round((screen - height) / 2), floor - height));
  return { top, height, bottomTop };
}
