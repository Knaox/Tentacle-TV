import type { CSSProperties, ReactNode } from "react";

/**
 * `FadeIn` de l'app (`components/ui/FadeIn.tsx`) : fondu + montée de 14 px,
 * 320 ms, après `delay`. Animation CSS bornée (transform + opacité).
 */
export function FadeIn({ children, delay = 0, translateY = 14, className, style }: {
  children: ReactNode;
  delay?: number;
  translateY?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`mirror-fade-in ${className ?? ""}`}
      style={{
        ...style,
        ["--fade-delay" as string]: `${delay}ms`,
        ["--fade-y" as string]: `${translateY}px`,
      }}
    >
      {children}
    </div>
  );
}
