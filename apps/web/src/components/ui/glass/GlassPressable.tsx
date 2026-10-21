import { forwardRef, useCallback, type ForwardedRef, type ReactNode } from "react";

import { PressableScale } from "../PressableScale";
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
 */
export const GlassPressable = forwardRef<HTMLButtonElement, GlassPressableProps>(
  function GlassPressable({ glass, style, children, ...props }, outerRef) {
    const control = useGlassControl<HTMLButtonElement>(glass);
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
      <PressableScale ref={ref} {...props} data-lgc-lens={control.props["data-lgc-lens"]} style={merged}>
        {control.layers}
        {children}
      </PressableScale>
    );
  },
);
