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
  /** Style de la peau d'avant (une ombre en ligne…) — seulement hors du mode natif. */
  fallbackStyle?: React.CSSProperties;
  /**
   * Le bouton vit DANS une surface (feuille, dialogue, panneau opaque) : jamais
   * de lentille — pas de verre sur du verre (lot lg7, R3). En natif, la PEAU
   * PEINTE des contrôles de lg4 (`lgSurfaceButtons.css`) : `glass` neutre,
   * `glassProminent` pour un niveau `prominent`, libellé rouge pour `danger`.
   */
  inSurface?: boolean;
  /** Une action destructive (avec `inSurface`) : le rouge au ton de la plaque. */
  danger?: boolean;
}

/**
 * Un `<button>` qui EST une surface de verre de la primitive en mode natif :
 * lentille calculée pour sa forme, lumière du bord, glyphes adaptés au
 * dessous (`data-lg-tone`), éclairé au survol, gonflé à l'appui (lentille de
 * lg-physique). Hors du mode natif : `className` + `fallbackClassName`,
 * exactement le bouton d'avant. `PressableGlass` en est la version à ressort.
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(props, ref) {
  // La variante ne change pas d'un rendu à l'autre chez un appelant : deux
  // composants, pour que la peau peinte ne monte ni lentille ni mesure du ton.
  return props.inSurface ? <SurfaceButton {...props} ref={ref} /> : <LensButton {...props} ref={ref} />;
});

const LensButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function LensButton({ appearance, className, fallbackClassName, fallbackStyle, style, children, type = "button", inSurface: _inSurface, danger: _danger, ...props }, ref) {
    const native = useLiquidGlassMode() === "native";
    const glass = useLiquidGlassSurface({ ...appearance, interactive: true, className, fallbackClassName, fallbackStyle, style, ref });
    return (
      <button type={type} {...props} {...(native ? GLASS_LENS_PROPS : {})} {...glass.props}>
        {glass.layers}
        {children}
      </button>
    );
  },
);

/** Les marqueurs de la peau peinte (aucun style hors de la porte). */
export function surfaceButtonClass(level: LiquidGlassAppearance["level"], danger: boolean | undefined): string {
  if (danger) return "lg-surface-btn lg-surface-btn-danger";
  return level === "prominent" ? "lg-surface-btn lg-surface-btn-prominent" : "lg-surface-btn";
}

const SurfaceButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function SurfaceButton({ appearance, className, fallbackClassName, fallbackStyle, style, children, type = "button", inSurface: _inSurface, danger, ...props }, ref) {
    const native = useLiquidGlassMode() === "native";
    // Hors natif : la jointure et la fusion de la primitive (`surfaceClassName`),
    // au caractère près — le bouton d'avant.
    const classes = native
      ? [surfaceButtonClass(appearance.level, danger), className].filter(Boolean).join(" ")
      : [className, fallbackClassName].filter(Boolean).join(" ") || undefined;
    const merged = native ? style : fallbackStyle || style ? { ...fallbackStyle, ...style } : undefined;
    return (
      <button type={type} {...props} ref={ref} className={classes} style={merged}>
        {children}
      </button>
    );
  },
);
