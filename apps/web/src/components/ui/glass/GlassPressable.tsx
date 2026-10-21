import { forwardRef, useCallback, type ForwardedRef, type ReactNode } from "react";

import { PressableScale } from "../PressableScale";
import { useLiquidGlassMode } from "../../../theme/glass";
import { useGlassControl, type GlassControlOptions } from "./useGlassControl";

type PressableScaleProps = React.ComponentProps<typeof PressableScale>;

interface GlassPressableProps extends Omit<PressableScaleProps, "children"> {
  children?: ReactNode;
  /** La lentille et le reflet de la surface — en mode natif seulement. */
  glass: GlassControlOptions;
}

function assignRef<T>(ref: ForwardedRef<T>, node: T | null): void {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

/**
 * `PressableScale` — son ressort, sa peau donnée par l'appelant — avec, en
 * mode natif, la lentille exacte de la surface et le reflet qui suit le
 * pointeur (`useGlassControl`). Hors natif : exactement `PressableScale`.
 *
 * En natif, son ressort se tait (échelles à 1) : la lentille de lg-physique
 * (`physics.css`, propriété `scale` sur `.lg-btn*`, `.lg-disc`,
 * `.hero-cta-primary`) fait le survol et l'appui — les deux s'additionneraient.
 */
export const GlassPressable = forwardRef<HTMLButtonElement, GlassPressableProps>(
  function GlassPressable({ glass, style, children, hoverScale, tapScale, ...props }, outerRef) {
    const control = useGlassControl<HTMLButtonElement>(glass);
    const native = useLiquidGlassMode() === "native";
    const { ref: controlRef } = control;
    const ref = useCallback(
      (node: HTMLButtonElement | null) => {
        controlRef(node);
        assignRef(outerRef, node);
      },
      [controlRef, outerRef],
    );
    const merged = control.props.style ? { ...style, ...control.props.style } : style;
    return (
      <PressableScale
        ref={ref}
        {...props}
        hoverScale={native ? 1 : hoverScale}
        tapScale={native ? 1 : tapScale}
        data-lgc-lens={control.props["data-lgc-lens"]}
        style={merged}
      >
        {control.layers}
        {children}
      </PressableScale>
    );
  },
);
