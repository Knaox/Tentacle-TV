import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useGridColumnHold } from "../../platform/tvos/focus/gridColumnHold";
import { useGridLineEntries } from "../../platform/tvos/focus/gridLineEntries";
import { useGridColumns } from "../../redesign/screens/library/PosterGrid";

/**
 * HAUT et BAS gardent la colonne dans la grille de l'écran : pas à pas
 * (tv-core `gridLineEntries`), et au défilement accéléré (`gridColumnHold`, la
 * grille posée) —
 * `count` affiches, les colonnes de la taille des cartes réglée, celles de
 * `PosterGrid`. Rend le rappel « grille posée » que l'écran fournit à sa
 * grille (`GridSettleProvider`).
 */
export function useGridColumnEntries(focus: FocusStore, count: number): () => void {
  const columns = useGridColumns();
  useGridLineEntries(focus, count, columns);
  return useGridColumnHold(focus, count, columns);
}
