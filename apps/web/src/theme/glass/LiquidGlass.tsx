/**
 * `<LiquidGlass>` — une surface de verre, sur l'élément de son choix (`as`).
 *
 *     <LiquidGlass
 *       as="nav" level="regular" shape="capsule"
 *       className="flex items-center gap-2 px-4"           // mise en page
 *       fallbackClassName="bg-black/60 backdrop-blur-xl"   // le rendu d'avant
 *     >…</LiquidGlass>
 *
 * Pour un `motion.div` ou tout élément qu'on ne peut pas remplacer :
 * `useLiquidGlassSurface`, dont ce composant n'est qu'un habillage.
 */

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type Ref,
} from "react";

import { useLiquidGlassSurface, type LiquidGlassSurfaceOptions } from "./useLiquidGlassSurface";

type OwnProps = Omit<LiquidGlassSurfaceOptions, "ref">;

export type LiquidGlassProps<T extends ElementType = "div"> = OwnProps & {
  /** L'élément rendu. Défaut `div`. */
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof OwnProps | "as">;

function LiquidGlassImpl(
  {
    as,
    level,
    shape,
    radius,
    tint,
    interactive,
    scale,
    z,
    group,
    spacing,
    transition,
    backdrop,
    // Sans effet (lot lg2) : retiré ici pour ne pas finir dans le DOM.
    bands: _bands,
    className,
    style,
    fallbackClassName,
    fallbackStyle,
    children,
    ...rest
  }: LiquidGlassProps<ElementType>,
  ref: Ref<HTMLElement>,
) {
  const glass = useLiquidGlassSurface({
    level,
    shape,
    radius,
    tint,
    interactive,
    scale,
    z,
    group,
    spacing,
    transition,
    backdrop,
    className,
    style,
    fallbackClassName,
    fallbackStyle,
    ref,
  });
  const Tag: ElementType = as ?? "div";
  return (
    <Tag {...rest} {...glass.props}>
      {glass.layers}
      {children}
    </Tag>
  );
}

export const LiquidGlass = forwardRef(LiquidGlassImpl) as <T extends ElementType = "div">(
  props: LiquidGlassProps<T> & { ref?: Ref<HTMLElement> },
) => ReactElement | null;
