/**
 * Le déplacement clavier d'une liste d'onglets, selon le motif WAI-ARIA
 * « Tabs » : ← et → passent à l'onglet voisin en bouclant aux extrémités,
 * Origine et Fin sautent au premier et au dernier. Toute autre touche ne
 * concerne pas la liste (`null`) — Tab, notamment, sort vers le panneau.
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Les identifiants DOM d'un onglet et de son panneau, reliés par `aria-controls` / `aria-labelledby`. */
export const tabDomId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelDomId = (prefix: string, id: string) => `${prefix}-panel-${id}`;
