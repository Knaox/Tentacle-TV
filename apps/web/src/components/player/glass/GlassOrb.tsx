import type { ReactNode } from "react";
import { GlassSurface } from "./GlassSurface";

interface GlassOrbProps {
  /** Les contrôles sont à l'écran. */
  visible: boolean;
  /** Le rond de lecture : plus grand. */
  primary?: boolean;
  /** Le PIVOT de son ensemble (`useCollapsePivots`) : les autres formes s'y replient. */
  pivot?: boolean;
  children: ReactNode;
}

/**
 * Un ROND de verre clair du lecteur (lot lg8, façon tvOS 26) : sa PROPRE forme
 * native, du groupe `player` — séparée de ses voisines au repos (l'écart dépasse
 * la distance de fusion), fondue avec elles quand elles se replient vers leur
 * pivot (`collapse`). Le bouton qu'il porte le remplit.
 *
 * Au niveau du module : défini dans un rendu, il changerait d'identité à chaque
 * battement de position et remonterait toute la rangée.
 */
export function GlassOrb({ visible, primary = false, pivot = false, children }: GlassOrbProps) {
  return (
    <GlassSurface
      className={primary ? "lgp-orb lgp-orb--primary" : "lgp-orb"}
      present={visible} collapse adaptiveTone
      data-lgp-pivot={pivot ? "" : undefined}
    >
      <div className="lgp-content">{children}</div>
    </GlassSurface>
  );
}
