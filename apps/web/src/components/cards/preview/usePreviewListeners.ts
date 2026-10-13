import { useEffect, useLayoutEffect, type RefObject } from "react";
import { cardFocusOwner, handlePreviewTab, returnFocusToCard } from "./previewFocus";
import type { PreviewCloseCause } from "./previewLifecycle";

interface PreviewListenersInput {
  shown: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  portalRef: RefObject<HTMLElement | null>;
  focusInsideRef: RefObject<boolean>;
  close: (cause: PreviewCloseCause) => void;
}

/**
 * Ce qui ferme une mini-carte MONTRÉE, et le clavier autour d'elle — posé
 * seulement le temps où elle est vue (un écouteur par aperçu, jamais par
 * carte) :
 *
 *   • le défilement (en capture : une rangée défile dans son propre
 *     conteneur, et `scroll` ne remonte pas), le redimensionnement → net ;
 *   • Échap, un appui ailleurs (en capture, avant que la surface visée ne
 *     s'ouvre), la fenêtre quittée → en douceur ;
 *   • Tab : la mini-carte s'insère dans le parcours juste après sa carte
 *     (`handlePreviewTab`).
 *
 * Partie avec le focus, elle le rend à sa carte : jamais un focus perdu dans
 * un portail démonté.
 */
export function usePreviewListeners({ shown, anchorRef, portalRef, focusInsideRef, close }: PreviewListenersInput): void {
  useEffect(() => {
    if (!shown) return;
    const leave = (cause: PreviewCloseCause) => {
      if (focusInsideRef.current) {
        focusInsideRef.current = false;
        returnFocusToCard(anchorRef.current);
      }
      close(cause);
    };
    const onScroll = () => leave("scroll");
    const onResize = () => leave("resize");
    const onWindowBlur = () => leave("window-blur");
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Node ? e.target : null;
      if (!target) return;
      const anchor = anchorRef.current;
      if (portalRef.current?.contains(target) || anchor?.contains(target) || cardFocusOwner(anchor)?.contains(target)) return;
      leave("pointer-outside");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        leave("escape");
        return;
      }
      if (handlePreviewTab(e, anchorRef.current, portalRef.current)) e.preventDefault();
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [shown, anchorRef, portalRef, focusInsideRef, close]);

  // Effacée par le moteur (fin, erreur) avec le focus dedans : il revient à la
  // carte AVANT que la mini-carte ne devienne inerte.
  useLayoutEffect(() => {
    if (shown || !focusInsideRef.current) return;
    focusInsideRef.current = false;
    returnFocusToCard(anchorRef.current);
  }, [shown, anchorRef, focusInsideRef]);
}
