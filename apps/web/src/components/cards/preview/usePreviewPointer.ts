import { useEffect, useState, type RefObject } from "react";
import { withinHoverCompanion } from "../../../hooks/hoverCompanion";
import { elementUnderPointer } from "../../../hooks/useHoverGuard";
import { cardFocusOwner } from "./previewFocus";
import { NO_HOLD, pointerHold, pointerSpot, type PointerHold } from "./previewPointer";

/** Ce que la souris interdit MAINTENANT à l'aperçu de cette carte (`previewPointer.ts`). */
function holdNow(anchor: HTMLElement, target?: EventTarget | null): PointerHold {
  // La GÉOMÉTRIE d'abord (`elementUnderPointer` : ce qu'il y a sous la dernière position connue),
  // toujours juste — l'état `:hover` du navigateur retarde quand un élément naît ou est remplacé
  // sous une souris immobile. À défaut de position connue, l'état `:hover`.
  let hit: Element | null = target instanceof Element ? target : elementUnderPointer();
  if (hit === null) {
    const hovered = anchor.querySelectorAll(":hover");
    hit = hovered.length > 0 ? hovered[hovered.length - 1] : null;
  }
  const spot = pointerSpot(anchor, hit, hit !== null && withinHoverCompanion(anchor, hit));
  const owner = cardFocusOwner(anchor);
  return pointerHold(spot, owner !== null && document.activeElement === owner);
}

const same = (a: PointerHold, b: PointerHold) => a.onControl === b.onControl && a.offImage === b.offImage;

/**
 * Où est la SOURIS dans la carte survolée, et ce que cela interdit à l'aperçu :
 * sur une commande du plateau (« Marquer comme vu », Ma liste, les étoiles et
 * leurs intervalles), ou hors de l'image (la légende) — tant qu'elle y est,
 * l'aperçu ne part pas ; revenue sur l'image, il repart, son délai depuis ce
 * retour. Pendant de `useKeyboardInCard` pour la souris.
 *
 * Trois trous refermés (relevé du 10/11) :
 *  1. le PREMIER rendu : la réponse est juste dès le rendu où le survol commence
 *     (état dérivé AU rendu, pas dans un effet) — le moteur ne voit jamais un
 *     survol « libre » le temps d'un effet, souris posée sur un bouton ;
 *  2. la carte NON focalisable (rangées de l'accueil) : son survol ne vient que
 *     de la souris, et sa racine déborde de l'image (la légende) — hors de
 *     l'image, rien ne part ;
 *  3. le bouton REMPLACÉ sous une souris immobile (« Marquer comme vu » bascule,
 *     le plateau naît au survol) : mesuré dans Chromium 156 (bureau CEF,
 *     `apps/desktop-cef/bench/survol/hoverlag.mjs`), `:hover` du nouveau bouton
 *     est FAUX à 0 ms et son `pointerover` de synthèse n'arrive que sous 50 ms,
 *     sans `pointerout` de l'ancien — alors que la géométrie est déjà juste. Le
 *     sous-arbre est observé, et la place relue par la géométrie.
 */
export function usePreviewPointer(anchorRef: RefObject<HTMLElement | null>, active: boolean): PointerHold {
  const [state, setState] = useState<{ active: boolean; hold: PointerHold }>({ active: false, hold: NO_HOLD });
  // Le survol commence (ou finit) À CE RENDU : la place de la souris est lue tout de suite.
  let current = state;
  if (state.active !== active) {
    const anchor = anchorRef.current;
    current = { active, hold: active && anchor ? holdNow(anchor) : NO_HOLD };
    setState(current);
  }

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!active || !anchor) return;
    const apply = (hold: PointerHold) => setState((known) => (known.active && !same(known.hold, hold) ? { active: true, hold } : known));
    // La souris change d'élément — dans la carte, ou vers sa légende (hors de l'ancre) : au document.
    const onOver = (e: PointerEvent) => apply(holdNow(anchor, e.target));
    // Le focus clavier arrive sur la carte ou la quitte : hors de l'image, c'est lui qui tranche.
    const onFocus = () => apply(holdNow(anchor));
    // Un élément naît, part ou est remplacé SOUS la souris immobile : relu par la géométrie, une
    // fois la mise en page faite (une lecture par image, au plus).
    let frame = 0;
    const recheck = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => apply(holdNow(anchor)));
    };
    const observer = typeof MutationObserver === "function" ? new MutationObserver(recheck) : null;
    observer?.observe(anchor, { childList: true, subtree: true });
    document.addEventListener("pointerover", onOver, { capture: true, passive: true });
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", onFocus, true);
    // Le plateau a pu naître entre le rendu et cet effet.
    recheck();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onFocus, true);
    };
  }, [anchorRef, active]);

  return current.active ? current.hold : NO_HOLD;
}
