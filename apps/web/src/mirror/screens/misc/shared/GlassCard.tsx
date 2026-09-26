import type { CSSProperties, ReactNode } from "react";

/**
 * `GlassCard` de l'app : `GlassSurface` d'intensité 40 → le verre
 * `.mirror-glass-modal`, rayon 16, filet `border.subtle`, padding 16
 * (`spacing.lg`) sauf surcharge.
 */
export function GlassCard({ children, padding = 16, className, style }: {
  children: ReactNode;
  padding?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`mirror-glass-modal overflow-hidden rounded-2xl border-[0.5px] border-line-subtle ${className ?? ""}`}
      style={{ padding, ...style }}
    >
      {children}
    </div>
  );
}
