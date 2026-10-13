import { useEffect, useState, type RefObject } from "react";

/**
 * Le focus CLAVIER est-il posé dans la carte elle-même — sur un bouton de son
 * plateau, pas sur la carte ? Tant qu'il y est, l'aperçu attend : agrandir la
 * carte sous les doigts de qui navigue dans son plateau lui retirerait les
 * boutons qu'il parcourt. Revenu sur la carte, l'aperçu repart.
 *
 * `:focus-visible` seulement : un bouton cliqué à la souris garde le focus,
 * et ne doit pas priver la souris de son aperçu.
 */
export function useKeyboardInCard(anchorRef: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [inside, setInside] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!active || !anchor) {
      setInside(false);
      return;
    }
    const focused = document.activeElement;
    setInside(focused instanceof HTMLElement && anchor.contains(focused) && focused.matches(":focus-visible"));
    const onIn = (e: FocusEvent) => {
      setInside(e.target instanceof HTMLElement && e.target.matches(":focus-visible"));
    };
    const onOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (!(next instanceof Node) || !anchor.contains(next)) setInside(false);
    };
    anchor.addEventListener("focusin", onIn);
    anchor.addEventListener("focusout", onOut);
    return () => {
      anchor.removeEventListener("focusin", onIn);
      anchor.removeEventListener("focusout", onOut);
    };
  }, [anchorRef, active]);

  return inside;
}
