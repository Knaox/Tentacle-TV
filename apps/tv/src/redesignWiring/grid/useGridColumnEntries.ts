import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useGridLineEntries } from "../../platform/tvos/focus/gridLineEntries";
import { useGridColumns } from "../../redesign/screens/library/PosterGrid";

/**
 * HAUT et BAS gardent la colonne dans la grille de l'écran (tv-core
 * `gridLineEntries`) : `count` affiches, les colonnes de la taille des cartes
 * réglée — celles de `PosterGrid`.
 */
export function useGridColumnEntries(focus: FocusStore, count: number): void {
  useGridLineEntries(focus, count, useGridColumns());
}
