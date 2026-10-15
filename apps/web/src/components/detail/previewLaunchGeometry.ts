/**
 * Géométrie du DÉPART DEPUIS L'APERÇU : la vidéo de la mini-carte grandit
 * jusqu'à couvrir la scène de la fiche, cadrée comme son décor.
 *
 * Pures, sans DOM : `PreviewLaunchOverlay` mesure, ces fonctions décident.
 */

export interface LaunchBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Le cadrage du décor (`DETAIL_STAGE_FOCUS`, « center 30% ») en fractions :
 * le rectangle qui couvre la scène s'y aligne, comme `object-position` aligne
 * l'image de la fiche — l'image qui arrive en fondu tombe sur la même région.
 */
export const STAGE_FOCUS = { x: 0.5, y: 0.3 } as const;

/**
 * Le rectangle qui COUVRE la scène (`object-fit: cover`) en gardant les
 * proportions de l'image de départ — c'est là que l'image de l'aperçu se
 * pose. Coordonnées dans la scène.
 */
export function stageCoverRect(
  stage: { width: number; height: number },
  aspect: number,
  focus: { x: number; y: number } = STAGE_FOCUS,
): LaunchBox {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  const width = Math.max(stage.width, stage.height * safeAspect);
  const height = width / safeAspect;
  return {
    left: (stage.width - width) * focus.x,
    top: (stage.height - height) * focus.y,
    width,
    height,
  };
}

/**
 * La transformation (origine en haut à gauche) qui ramène le rectangle
 * d'arrivée sur celui de départ : l'élément est posé à sa place FINALE et
 * voyage en `transform` seulement — jamais une propriété de mise en page.
 * Échelle UNIFORME : départ et arrivée ont les mêmes proportions.
 */
export function launchFromTransform(from: LaunchBox, to: LaunchBox): { x: number; y: number; scale: number } {
  if (to.width <= 0) return { x: 0, y: 0, scale: 1 };
  return { x: from.left - to.left, y: from.top - to.top, scale: from.width / to.width };
}
