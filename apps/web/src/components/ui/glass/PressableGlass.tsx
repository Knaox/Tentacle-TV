import { forwardRef, type ReactNode } from "react";

import { PressableScale } from "../PressableScale";
import {
  GLASS_LENS_PROPS,
  useLiquidGlassMode,
  useLiquidGlassSurface,
  type LiquidGlassAppearance,
} from "../../../theme/glass";

type PressableScaleProps = React.ComponentProps<typeof PressableScale>;

interface PressableGlassProps extends Omit<PressableScaleProps, "children" | "className"> {
  children?: ReactNode;
  /** Le verre en mode natif : niveau, forme, teinte (la primitive de lg-tokens). */
  appearance: Omit<LiquidGlassAppearance, "interactive">;
  /** Mise en page — appliquée dans TOUS les modes. Ni couleur, ni flou, ni bord. */
  className?: string;
  /** La peau d'avant (fond, bord, ombre, survol) — seulement hors du mode natif. */
  fallbackClassName?: string;
}

/**
 * Un bouton à ressort (`PressableScale`) qui EST une surface de verre de la
 * primitive en mode natif : lentille calculée pour sa forme, lumière du bord,
 * glyphes adaptés au dessous (`data-lg-tone`), éclairé au survol ; la
 * lentille de lg-physique (`data-lg-lens`) le gonfle à l'appui — le ressort
 * de framer se tait alors, les deux s'additionneraient.
 *
 * Hors du mode natif : `className` + `fallbackClassName`, le ressort
 * d'avant — exactement le bouton d'avant.
 */
export const PressableGlass = forwardRef<HTMLButtonElement, PressableGlassProps>(
  function PressableGlass(
    { appearance, className, fallbackClassName, style, children, hoverScale, tapScale, ...props },
    ref,
  ) {
    const native = useLiquidGlassMode() === "native";
    const glass = useLiquidGlassSurface({
      ...appearance,
      interactive: true,
      className,
      fallbackClassName,
      style: style as React.CSSProperties | undefined,
      ref,
    });
    return (
      <PressableScale
        {...props}
        {...(native ? GLASS_LENS_PROPS : {})}
        {...glass.props}
        hoverScale={native ? 1 : hoverScale}
        tapScale={native ? 1 : tapScale}
      >
        {glass.layers}
        {children}
      </PressableScale>
    );
  },
);
