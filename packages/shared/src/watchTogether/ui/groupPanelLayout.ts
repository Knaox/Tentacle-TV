/**
 * Watch Together — où se pose le panneau du groupe (membres, chat) dans le
 * lecteur, d'après la fenêtre COURANTE (rotation, Split View de l'iPad) :
 *  - « side »    : tablette en paysage — deux colonnes, la vidéo se resserre
 *                  à gauche, le panneau à droite ; rien ne recouvre l'image ;
 *  - « below »   : tablette en portrait — la vidéo en haut (16:9), le panneau
 *                  dessous, dans la place que la vidéo n'occupe pas ;
 *  - « overlay » : téléphone en paysage — un panneau à droite, PAR-DESSUS la
 *                  vidéo (pas la place de la resserrer) ;
 *  - « sheet »   : téléphone en portrait — une feuille du bas.
 * Module PUR : les seuils viennent du thème (`TABLET_MIN_WIDTH`).
 */

export type GroupPanelLayout = "side" | "below" | "overlay" | "sheet";

export const SIDE_PANEL_WIDTH = 360;
export const OVERLAY_PANEL_WIDTH = 320;

export function groupPanelLayout(width: number, height: number, tabletMinWidth: number): GroupPanelLayout {
  const tablet = Math.min(width, height) >= tabletMinWidth;
  const landscape = width > height;
  if (tablet) return landscape ? "side" : "below";
  return landscape ? "overlay" : "sheet";
}

/** La hauteur de la vidéo quand le panneau est dessous : 16:9 sur la largeur, au plus la moitié. */
export function videoHeightAbove(width: number, height: number): number {
  return Math.round(Math.min((width * 9) / 16, height / 2));
}
