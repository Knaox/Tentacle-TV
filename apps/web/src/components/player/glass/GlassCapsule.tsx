import type { CSSProperties, ReactNode } from "react";
import { GlassSurface } from "./GlassSurface";

interface GlassCapsuleProps {
  /** Les contrôles sont à l'écran. */
  visible: boolean;
  /** L'ORDRE d'apparition (0 d'abord) : le transport, puis les réglages, puis le haut. */
  order?: number;
  /** La capsule change de largeur à l'instant (le curseur du volume paraît ou part). */
  instant?: boolean;
  children: ReactNode;
}

/**
 * Une CAPSULE de verre du lecteur (lot rf2, nov. 2026) : la capsule d'encre de l'habillage
 * sans verre (`.pl-caps`, `chrome/playerChrome.css`), au même endroit, à la même taille, avec
 * les mêmes boutons dans le même ordre. Depuis nov. 2026 elle en a aussi la MATIÈRE : l'encre
 * (`material="ink"`), plus une forme de verre natif — Damien : « le rendu Liquid Glass sur les
 * boutons du lecteur n'est pas du tout beau ; on le garde pour les menus ». Elle garde le geste
 * d'apparition des formes du lecteur en verre, à son rang (`playerGlassDim.css`, « L'encre »).
 *
 * Avant ce lot, le lecteur en verre avait SA disposition (des ronds séparés, le transport au
 * centre, le son à gauche) : allumer le réglage déplaçait toutes les commandes. Damien :
 * « la même disposition, avec des composants Liquid Glass ».
 *
 * Au niveau du module : défini dans un rendu, il changerait d'identité à chaque battement de
 * position et remonterait toute la rangée.
 */
export function GlassCapsule({ visible, order = 0, instant = false, children }: GlassCapsuleProps) {
  return (
    <GlassSurface
      className="lgp-caps"
      present={visible} materialize={order} material="ink" instant={instant}
      style={{ "--lgp-order": order } as CSSProperties}
    >
      <div className="lgp-content">{children}</div>
    </GlassSurface>
  );
}
