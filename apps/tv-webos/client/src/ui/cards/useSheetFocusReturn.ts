import { useEffect, useRef, type RefObject } from "react";

/**
 * Rend le focus à la carte quand sa feuille d'actions se referme.
 *
 * La feuille confine le D-pad pendant qu'elle est ouverte ; fermée, l'élément
 * focalisé disparaît avec elle et le moteur retomberait sur sa mémoire — la
 * PAGE, pas la carte. On revient là où l'appui long est parti, comme toute
 * modale de salon. Après une navigation (lire, ouvrir la fiche), la carte n'est
 * plus montée : il n'y a rien à faire.
 */
export function useSheetFocusReturn(root: RefObject<HTMLElement | null>, open: boolean): void {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) root.current?.focus();
    wasOpen.current = open;
  }, [open, root]);
}
