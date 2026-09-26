import type { ReactNode } from "react";

/**
 * `CascadeGroup` de l'app : le groupe monte de huit en fondu, décalé de 40 ms
 * par rang, rejoué chaque fois que la diapositive devient active — la classe
 * retirée puis reposée relance l'animation CSS, sans remonter le contenu.
 * Transform/opacité seulement.
 */
export function CascadeGroup({ order, active, children }: { order: number; active: boolean; children: ReactNode }) {
  return (
    <div
      className={active ? "mirror-hero-cascade" : undefined}
      style={active ? { animationDelay: `${order * 40}ms` } : undefined}
    >
      {children}
    </div>
  );
}
