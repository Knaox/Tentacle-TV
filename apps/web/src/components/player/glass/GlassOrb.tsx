import type { CSSProperties, ReactNode } from "react";
import { GlassSurface } from "./GlassSurface";

interface GlassOrbProps {
  /** Les contrôles sont à l'écran. */
  visible: boolean;
  /** Le rond de lecture : plus grand. */
  primary?: boolean;
  /** Le PIVOT de son ensemble (`useCollapsePivots`) : les autres formes s'y replient. */
  pivot?: boolean;
  /**
   * L'ORDRE d'apparition (0 d'abord) : le transport, puis le son, les réglages et la
   * barre, puis le haut. Posé en `--lgp-order` pour qui l'anime (lot lg8, apparition).
   */
  order?: number;
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
export function GlassOrb({ visible, primary = false, pivot = false, order = 0, children }: GlassOrbProps) {
  return (
    <GlassSurface
      className={primary ? "lgp-orb lgp-orb--primary" : "lgp-orb"}
      present={visible} collapse adaptiveTone
      data-lgp-pivot={pivot ? "" : undefined}
      style={{ "--lgp-order": order } as CSSProperties}
    >
      <div className="lgp-content">{children}</div>
    </GlassSurface>
  );
}
