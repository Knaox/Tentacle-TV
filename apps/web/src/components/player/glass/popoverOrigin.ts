import { useLayoutEffect, useState, type RefObject } from "react";
import { useGlassDock } from "./glassDock";
import type { MaterializeOrigin } from "./playerGlassMaterialize";
import type { PlayerMorphId } from "./playerGlassFusion";

/**
 * D'où naît un popover du lecteur : le bouton qui l'ouvre porte
 * `popoverAnchorProps(id)` ; le panneau, calé sur le bord droit du dock
 * (`.lgp-popover`), prend pour origine de son échelle le CENTRE de ce bouton —
 * il grandit depuis lui (lot lg8, à la place de la graine `GlassMorphSeed`).
 */
export function popoverAnchorProps(id: PlayerMorphId): { "data-lgp-anchor": PlayerMorphId } {
  return { "data-lgp-anchor": id };
}

export interface PopoverOrigin {
  /** En fractions du panneau, pour la coquille. */
  origin: MaterializeOrigin;
  /** Pour la page : à tant de px du bord DROIT, en bas — juste avant même la mise en page du panneau. */
  originCss: string;
}

const DEFAULT: PopoverOrigin = { origin: { x: 1, y: 1 }, originCss: "100% 100%" };

/**
 * Mesuré avant la première image (effet de mise en page) : le panneau est
 * posé, le bouton et le dock aussi. Sans bouton trouvé : le coin bas-droit.
 */
export function usePopoverOrigin(id: PlayerMorphId, panel: RefObject<HTMLElement | null>): PopoverOrigin {
  const dock = useGlassDock();
  const [origin, setOrigin] = useState<PopoverOrigin>(DEFAULT);
  useLayoutEffect(() => {
    const anchor = dock?.querySelector(`[data-lgp-anchor="${id}"]`);
    const element = panel.current;
    if (dock === null || anchor == null || element === null) return;
    const next = popoverOriginOf(dock.getBoundingClientRect(), anchor.getBoundingClientRect(), element.offsetWidth);
    setOrigin((previous) => (previous.originCss === next.originCss && previous.origin.x === next.origin.x ? previous : next));
  }, [dock, id, panel]);
  return origin;
}

/** La règle, à part pour être testée : le centre du bouton, compté depuis le bord droit du dock. */
export function popoverOriginOf(dock: Pick<DOMRect, "right">, anchor: Pick<DOMRect, "left" | "width">, panelWidth: number): PopoverOrigin {
  const fromRight = Math.max(0, dock.right - (anchor.left + anchor.width / 2));
  const x = panelWidth > 0 ? Math.min(1, Math.max(0, (panelWidth - fromRight) / panelWidth)) : 1;
  return { origin: { x, y: 1 }, originCss: `calc(100% - ${String(Math.round(fromRight))}px) 100%` };
}
