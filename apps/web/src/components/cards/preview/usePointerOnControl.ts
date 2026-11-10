import { useEffect, useState, type RefObject } from "react";

/** Ce qui se commande dans le plateau d'une carte : boutons, liens, champs. */
const CONTROL = "button, a[href], [role=\"button\"], input, select, textarea";

/** L'élément est-il (dans) une commande DU PLATEAU — jamais la carte elle-même, souvent un lien ? */
function onControl(anchor: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest(CONTROL);
  return control !== null && control !== anchor && anchor.contains(control);
}

/**
 * La SOURIS est-elle sur une commande du plateau de la carte (« Marquer comme
 * vu », Ma liste, les étoiles) ? Tant qu'elle y est, l'aperçu ne part pas :
 * qui vise un bouton ne veut pas voir la carte s'agrandir sous lui. Revenue
 * sur l'image, l'aperçu repart, son délai depuis ce retour. Pendant de
 * `useKeyboardInCard` pour la souris.
 */
export function usePointerOnControl(anchorRef: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!active || !anchor) {
      setOn(false);
      return;
    }
    // Arrivée droit sur un bouton (le plateau paraît sous une souris immobile) : le plus
    // profond des éléments survolés de la carte.
    const hovered = anchor.querySelectorAll(":hover");
    setOn(hovered.length > 0 && onControl(anchor, hovered[hovered.length - 1]));
    const onOver = (e: PointerEvent) => setOn(onControl(anchor, e.target));
    const onOut = (e: PointerEvent) => {
      if (!(e.relatedTarget instanceof Node) || !anchor.contains(e.relatedTarget)) setOn(false);
    };
    anchor.addEventListener("pointerover", onOver);
    anchor.addEventListener("pointerout", onOut);
    return () => {
      anchor.removeEventListener("pointerover", onOver);
      anchor.removeEventListener("pointerout", onOut);
    };
  }, [anchorRef, active]);

  return on;
}
