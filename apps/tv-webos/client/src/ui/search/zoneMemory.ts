import { useCallback, useRef, type FocusEvent } from "react";
import { ENTRY_ATTRIBUTE } from "../../focus/zones";

/**
 * Une zone qui se souvient de sa dernière cible — le `autoFocus` des
 * `TVFocusGuideView` de l'Apple TV et d'Android TV.
 *
 * Le moteur sait déjà rediriger une arrivée transversale dans une zone vers sa
 * destination déclarée (`data-tv-zone-entree`, cf. `focus/zones.ts`). Il suffit
 * donc de DÉPLACER cette marque sur ce qui prend le focus dans la zone : on y
 * revient là où on l'avait quittée — la touche de la colonne de saisie, la
 * carte des résultats —, jamais sur ce que la géométrie trouve en face.
 *
 * Tant que rien n'a été visé, la cascade du moteur s'applique : le premier
 * focusable de la zone, c'est-à-dire le meilleur résultat. Une cible démontée
 * (nouvelle requête) emporte sa marque avec elle : on retombe sur la cascade.
 */
export function useZoneMemory(): (event: FocusEvent<HTMLElement>) => void {
  const marked = useRef<HTMLElement | null>(null);

  return useCallback((event: FocusEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target === marked.current) return;
    marked.current?.removeAttribute(ENTRY_ATTRIBUTE);
    target.setAttribute(ENTRY_ATTRIBUTE, "");
    marked.current = target;
  }, []);
}
