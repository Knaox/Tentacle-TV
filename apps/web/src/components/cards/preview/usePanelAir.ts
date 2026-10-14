import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * L'AIR du bandeau. Sur une affiche, la mini-carte couvre la hauteur de
 * l'affiche soulevée (`previewPlacement.ts`) : son bandeau est souvent plus haut
 * que son contenu, et l'excédent faisait une bande morte au pied (≈ 40 px à
 * 1 440 px de fenêtre). Il est réparti : une part au-dessus des actions (plus
 * d'air entre la vidéo et les ronds), une part entre les actions et le titre,
 * le reste au pied — jamais rien de tassé, jamais rien qui déborde.
 *
 * Mesuré, pas deviné : le bas du contenu tel qu'il est posé (les lignes, le
 * titre et ses étoiles, qu'elles soient à côté du titre ou dessous), relu à
 * chaque changement de ce qui s'écrit — en coordonnées de MISE EN PAGE
 * (`offsetTop`), que l'échelle de l'entrée ne fausse pas. Une mise en page de
 * plus à la révélation, aucune pendant le mouvement.
 */

/** La part de l'excédent posée au-dessus des actions. */
export const PANEL_AIR_ABOVE = 0.4;
/** La part posée entre les actions et le titre ; le reste (0,3) va au pied. */
export const PANEL_AIR_BETWEEN = 0.3;

/** Ce qui est déjà posé en air au-dessus du bas du contenu (il décale tout ce qui suit les actions). */
export function panelAirApplied(air: number): number {
  return Math.round(air * PANEL_AIR_ABOVE) + Math.round(air * PANEL_AIR_BETWEEN);
}

/**
 * L'excédent à répartir, d'après une mesure : `bottom` le bas du contenu tel
 * qu'il est posé (air actuel compris), `air` l'air actuel, `height` la hauteur
 * intérieure du bandeau, `foot` le pied à garder. Jamais négatif ; la même
 * réponse que l'air actuel quand rien n'a bougé (aucune boucle).
 */
export function panelAirOf({ bottom, air, height, foot }: { bottom: number; air: number; height: number; foot: number }): number {
  const natural = bottom - panelAirApplied(air);
  return Math.max(0, Math.floor(height - natural - foot));
}

/**
 * L'excédent de hauteur du bandeau (px), à répartir — 0 quand le contenu le
 * remplit. Mesuré seulement quand le bandeau est COMPLET (`complete` : le
 * groupe du survol monté, à la révélation) ; à la sortie, rien ne se remesure —
 * l'air reste tel quel le temps du fondu.
 */
export function usePanelAir(panelRef: RefObject<HTMLDivElement | null>, layoutKey: string, complete: boolean): number {
  const [air, setAir] = useState(0);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !complete) return;
    // Les éléments posés dans la rangée du bandeau : ses enfants, et ceux du
    // groupe du survol, transparent à la mise en page.
    const items = panel.querySelectorAll<HTMLElement>(":scope > :not(.card-preview-group), :scope > .card-preview-group > *");
    let bottom = 0;
    for (const item of items) bottom = Math.max(bottom, item.offsetTop + item.offsetHeight);
    if (bottom === 0) return;
    // Le pied garde au moins la marge du haut du bandeau.
    const foot = Number.parseFloat(getComputedStyle(panel).paddingTop) || 0;
    const next = panelAirOf({ bottom, air, height: panel.clientHeight, foot });
    if (Math.abs(next - air) >= 2) setAir(next);
  }, [panelRef, layoutKey, complete, air]);
  return air;
}
