import { motion, useReducedMotion } from "framer-motion";
import { glassMorphProps } from "../../../theme/glass";
import type { PlayerMorphId } from "./playerGlassFusion";

/**
 * La graine d'une métamorphose : un calque INVISIBLE, posé sur le bouton, qui
 * porte le `layoutId` du panneau qu'il ouvre (`glassMorphProps`, lg-physique).
 *
 * Pourquoi pas le bouton lui-même : de deux formes au même `layoutId`, framer
 * cache la plus ancienne tant que la nouvelle est là — le bouton disparaîtrait
 * pendant que son panneau est ouvert. La graine, elle, n'a rien à montrer.
 *
 * Le bouton qui la porte doit être positionné (`relative`).
 */
export function GlassMorphSeed({ id }: { id: PlayerMorphId }) {
  const reduced = useReducedMotion();
  return <motion.span aria-hidden="true" className="lgp-morph-seed" {...glassMorphProps(id, reduced)} />;
}
