import { useCallback, useEffect, useRef, type RefObject } from "react";
import { spacing } from "@/theme";
import { FLOATING_BACK_SIZE } from "@/components/navigation/FloatingBackButton";

/** Ce qu'une liste sait faire pour qu'on y amarre le champ. */
interface Scrollable {
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
}

/**
 * Le champ de recherche d'une collection monte sous le retour flottant quand
 * on y tape — comme dans la Bibliothèque (`LibraryCatalogView`) : l'en-tête
 * s'efface, les suggestions ont la place au-dessus du clavier.
 *
 * `onControlsY` reçoit la position des contrôles dans l'en-tête de la liste ;
 * `topInset` est le rembourrage haut de la liste (la zone sûre).
 */
export function useSearchDock(listRef: RefObject<Scrollable | null>, focused: boolean, topInset: number) {
  const controlsY = useRef(0);
  const onControlsY = useCallback((y: number) => { controlsY.current = y; }, []);
  useEffect(() => {
    if (!focused) return;
    const offset = topInset + controlsY.current - (FLOATING_BACK_SIZE + spacing.sm);
    listRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: true });
  }, [focused, listRef, topInset]);
  return onControlsY;
}
