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
  const [state, setState] = useState({ active: false, inside: false });
  // Le survol commence (ou finit) À CE RENDU : le focus est lu tout de suite — jamais « hors du
  // plateau » le temps d'un effet, focus posé sur un de ses boutons (cf. `usePreviewPointer`).
  let current = state;
  if (state.active !== active) {
    current = { active, inside: active && focusInCard(anchorRef.current) };
    setState(current);
  }

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!active || !anchor) return;
    const apply = (inside: boolean) => setState((known) => (known.active && known.inside !== inside ? { active: true, inside } : known));
    const onIn = (e: FocusEvent) => {
      apply(e.target instanceof HTMLElement && e.target.matches(":focus-visible"));
    };
    const onOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (!(next instanceof Node) || !anchor.contains(next)) apply(false);
    };
    anchor.addEventListener("focusin", onIn);
    anchor.addEventListener("focusout", onOut);
    return () => {
      anchor.removeEventListener("focusin", onIn);
      anchor.removeEventListener("focusout", onOut);
    };
  }, [anchorRef, active]);

  return current.active && current.inside;
}

/** Le focus CLAVIER est-il, maintenant, sur un élément de la carte (son plateau) ? */
function focusInCard(anchor: HTMLElement | null): boolean {
  if (!anchor || typeof document === "undefined") return false;
  const focused = document.activeElement;
  return focused instanceof HTMLElement && anchor.contains(focused) && focused.matches(":focus-visible");
}
