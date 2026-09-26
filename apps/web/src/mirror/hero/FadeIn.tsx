import type { ReactNode } from "react";
import "./hero.css";

/**
 * `FadeIn` de l'app : entrée en fondu et montée de 14, 320 ms, après `delay`.
 * Jouée une fois au montage (animation CSS finie, transform/opacité).
 */
export function FadeIn({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  return (
    <div className="mirror-fade-in" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Cascade d'entrée de l'accueil (`homeRowFade.ts`) : la i-ème rangée entre
 *  un peu après la précédente. */
export const homeRowFadeDelay = (index: number): number => 100 + index * 70;
