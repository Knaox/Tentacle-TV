import { forwardRef, type ButtonHTMLAttributes } from "react";

import {
  GLASS_LENS_PROPS,
  useLiquidGlassMode,
  useLiquidGlassSurface,
  type LiquidGlassAppearance,
} from "../../../theme/glass";

interface GlassButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /** Le verre en mode natif : niveau, forme, teinte (la primitive de lg-tokens). */
  appearance: Omit<LiquidGlassAppearance, "interactive">;
  /** Mise en page — appliquée dans TOUS les modes. Ni couleur, ni flou, ni bord. */
  className?: string;
  /** La peau d'avant (fond, bord, ombre, survol) — seulement hors du mode natif. */
  fallbackClassName?: string;
}

/**
 * Un `<button>` qui EST une surface de verre de la primitive en mode natif :
 * lentille calculée pour sa forme, lumière du bord, glyphes adaptés au
 * dessous (`data-lg-tone`), éclairé au survol, gonflé à l'appui (lentille de
 * lg-physique). Hors du mode natif : `className` + `fallbackClassName`,
 * exactement le bouton d'avant. `PressableGlass` en est la version à ressort.
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton({ appearance, className, fallbackClassName, style, children, type = "button", ...props }, ref) {
    const native = useLiquidGlassMode() === "native";
    const glass = useLiquidGlassSurface({ ...appearance, interactive: true, className, fallbackClassName, style, ref });
    return (
      <button type={type} {...props} {...(native ? GLASS_LENS_PROPS : {})} {...glass.props}>
        {glass.layers}
        {children}
      </button>
    );
  },
);
