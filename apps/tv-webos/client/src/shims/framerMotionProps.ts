/**
 * Propriétés propres à framer-motion, à retirer avant d'atteindre le DOM.
 *
 * Données pures. React 19 transmet au DOM toute propriété qu'il ne reconnaît
 * pas, en minuscules : sans ce filtre, `layoutId="topnav-active-pill"`
 * ([TopNavLinks.tsx](../../../../web/src/components/nav/TopNavLinks.tsx))
 * deviendrait un attribut `layoutid` sur le nœud, et `variants` un attribut
 * portant un objet sérialisé. Rien ne planterait — ce serait simplement du
 * balisage sale et des avertissements en console.
 *
 * `style`, `className` et les gestionnaires d'événements standards ne sont PAS
 * dans cette liste : ce sont des propriétés React ordinaires, que les
 * composants attendent de voir arriver.
 */
export const PROPRIETES_ANIMATION: ReadonlySet<string> = new Set([
  // Cycle de vie de l'animation
  "initial",
  "animate",
  "exit",
  "variants",
  "transition",
  "custom",
  // États déclenchés par l'interaction
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileDrag",
  "whileInView",
  "viewport",
  // Animations de disposition
  "layout",
  "layoutId",
  "layoutScroll",
  "layoutRoot",
  "layoutDependency",
  "transformTemplate",
  // Glisser-déposer
  "drag",
  "dragConstraints",
  "dragControls",
  "dragElastic",
  "dragMomentum",
  "dragListener",
  "dragSnapToOrigin",
  "dragPropagation",
  "dragDirectionLock",
  "dragTransition",
  // Rappels — retirés du DOM, mais deux d'entre eux sont invoqués par le shim
  "onAnimationStart",
  "onAnimationComplete",
  "onUpdate",
  "onDrag",
  "onDragStart",
  "onDragEnd",
  "onDirectionLock",
  "onViewportEnter",
  "onViewportLeave",
  "onLayoutAnimationStart",
  "onLayoutAnimationComplete",
  // Divers
  "inherit",
  "ignoreStrict",
]);

/** Sépare les propriétés destinées au DOM de celles qui n'y ont rien à faire. */
export function trierProprietes(
  proprietes: Record<string, unknown>,
): { dom: Record<string, unknown>; animation: Record<string, unknown> } {
  const dom: Record<string, unknown> = {};
  const animation: Record<string, unknown> = {};
  for (const cle of Object.keys(proprietes)) {
    if (PROPRIETES_ANIMATION.has(cle)) animation[cle] = proprietes[cle];
    else dom[cle] = proprietes[cle];
  }
  return { dom, animation };
}
