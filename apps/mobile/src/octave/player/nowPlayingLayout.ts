/**
 * Octave (mobile) — la mise en page du lecteur plein écran : en COLONNE sur un téléphone en portrait ; CÔTE À
 * CÔTE (pochette à gauche, commandes et file à droite) sur une tablette ou un écran couché. Et la taille de la
 * pochette qui en découle, jamais plus grande que ce que l'écran laisse aux commandes.
 */

export type NowPlayingLayout = "column" | "split";

export function nowPlayingLayout(width: number, height: number): NowPlayingLayout {
  return width >= 700 || width > height * 1.15 ? "split" : "column";
}

/** La pochette (pt) : la largeur moins les marges, bornée par la hauteur disponible. */
export function nowPlayingArtworkSize(layout: NowPlayingLayout, width: number, height: number): number {
  if (layout === "split") return Math.round(Math.max(160, Math.min(width * 0.44, height - 140, 560)));
  return Math.round(Math.max(160, Math.min(width - 48, height * 0.42, 440)));
}
