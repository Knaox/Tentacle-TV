import type { CSSProperties, ReactNode } from "react";
import { hitSlop } from "../playerColors";

interface Props {
  onPress: () => void;
  label: string;
  style?: CSSProperties;
  className?: string;
  /** Zone tactile agrandie autour du bouton (le `hitSlop` de l'app), en px. */
  slop?: number;
  children: ReactNode;
}

/**
 * Le `Pressable` des contrôles du lecteur : un bouton nu, sans reflet de tap,
 * dont la zone tactile déborde de `slop` pixels (16 par défaut, comme l'app)
 * sans bouger la mise en page. Il capte le pointeur même quand son parent le
 * laisse passer (`box-none` de l'app = `pointer-events-none` au parent).
 */
export function TouchButton({ onPress, label, style, className, slop = 16, children }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onPress(); }}
      className={`pointer-events-auto relative flex items-center justify-center [-webkit-tap-highlight-color:transparent] ${className ?? ""}`}
      style={style}
    >
      {slop > 0 && <span aria-hidden style={hitSlop(slop)} />}
      {children}
    </button>
  );
}
