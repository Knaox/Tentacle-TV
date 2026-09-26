import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { useLongPress } from "./useLongPress";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  onPress?: () => void;
  onLongPress?: () => void;
  /** Échelle sous le doigt (`PressableCard` : 0,97). */
  scale?: number;
  style?: CSSProperties;
}

/**
 * Le `PressableCard` de l'app : un bouton qui se tasse sous le doigt (échelle
 * seulement, rien à repeindre) et connaît l'appui long.
 */
export const Pressable = forwardRef<HTMLButtonElement, Props>(function Pressable(
  { onPress, onLongPress, scale = 0.97, style, className, children, ...rest },
  ref,
) {
  const press = useLongPress(onLongPress);
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      {...press.handlers}
      onClick={() => {
        if (!press.consumeClick()) onPress?.();
      }}
      className={`mirror-pressable block text-left ${className ?? ""}`}
      style={{ ...style, ["--press-scale" as string]: scale, WebkitTapHighlightColor: "transparent" }}
    >
      {children}
    </button>
  );
});
