import type { CSSProperties, ReactNode } from "react";
import { GlassSurface } from "./GlassSurface";

interface GlassOrbProps {
  /** Les contrôles sont à l'écran. */
  visible: boolean;
  /**
   * L'ORDRE d'apparition (0 d'abord) : le transport, puis le son, les réglages et la
   * barre, puis le haut — le rang de la matérialisation (`materialize`), et
   * `--lgp-order` pour ce qui est nu autour (titre, barre).
   */
  order?: number;
  children: ReactNode;
}

/**
 * Le ROND de la SORTIE, seul sur l'image en haut à gauche : la pastille d'ENCRE
 * `.pl-btn--solo` de l'habillage sans verre (`material="ink"`, nov. 2026 : les
 * commandes du lecteur ne sont plus en verre), qui garde le geste d'apparition des
 * formes du lecteur à son rang (`materialize`). Le bouton qu'il porte le remplit. Les commandes du bas vivent dans deux
 * capsules (`GlassCapsule`).
 *
 * Au niveau du module : défini dans un rendu, il changerait d'identité à chaque
 * battement de position et remonterait toute la rangée.
 */
export function GlassOrb({ visible, order = 0, children }: GlassOrbProps) {
  return (
    <GlassSurface
      className="lgp-orb"
      present={visible} materialize={order} material="ink"
      style={{ "--lgp-order": order } as CSSProperties}
    >
      <div className="lgp-content">{children}</div>
    </GlassSurface>
  );
}
