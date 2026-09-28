import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { fadeIn } from "../../theme/motion";

/**
 * Une section de fiche qui entre en fondu UNE fois, à son arrivée dans le
 * champ — le geste des sections de la fiche en ligne (`DetailSections`), sans
 * quoi la fiche locale se lirait comme une page de réglages.
 */
export function RevealOnView({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}
