/**
 * La LENTILLE d'un contrôle segmenté de réglages (`.lg-segmented` +
 * `.ctl-segment`), sous le verre de macOS 26 seulement (lot lg4).
 *
 * Hors du mode natif, elle ne rend RIEN : le segment choisi garde son calque
 * `::before` (fondu d'opacité), le DOM d'avant au nœud près. En natif, elle se
 * pose DANS le segment choisi ; quand le choix change, framer la fait GLISSER
 * jusqu'au nouveau segment par `layoutId` — en `transform`, comme la pastille
 * de la barre d'onglets (`glassMorphProps`, ressort `morph`). Mouvement réduit :
 * un fondu court, pas de trajet. Sa peau est dans `lgPageGlass.css`.
 *
 *     const group = useId();
 *     {selected && <SegmentLens group={group} />}
 */

import { motion, useReducedMotion } from "framer-motion";

import { glassMorphProps, useLiquidGlassMode } from "../../../theme/glass";

export function SegmentLens({ group }: { group: string }) {
  // La porte d'abord, sans aucun crochet de plus : hors du mode natif, le
  // segmenté rend exactement ce qu'il rendait.
  return useLiquidGlassMode() === "native" ? <NativeSegmentLens group={group} /> : null;
}

function NativeSegmentLens({ group }: { group: string }) {
  const morph = glassMorphProps(`segment-${group}`, useReducedMotion());
  // Le rayon passe en `style` : framer le corrige pendant l'étirement (des coins
  // ronds tout le trajet) ; c'est la capsule des segmentés natifs.
  return (
    <motion.span
      aria-hidden
      layoutId={morph.layoutId}
      transition={morph.transition}
      style={{ borderRadius: 9999 }}
      className="lg-seg-lens"
    />
  );
}
