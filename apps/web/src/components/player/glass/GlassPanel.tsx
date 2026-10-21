import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode, Ref } from "react";
import { GlassSurface } from "./GlassSurface";
import "./playerGlassPanels.css";

interface GlassPanelProps {
  /** Classes de taille et de mise en page de l'habillage d'avant (largeur, hauteur max…). */
  className?: string;
  /** Classes du corps (remplissage, colonne…). */
  bodyClassName?: string;
  surfaceRef?: Ref<HTMLDivElement>;
  role?: string;
  "aria-label"?: string;
  children: ReactNode;
}

/** Ressort court et ferme : le panneau sort du bouton, il ne flotte pas. */
const SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
const EXIT = { duration: 0.16, ease: [0.4, 0, 1, 1] } as const;

/**
 * Un panneau du lecteur en verre — pistes, vitesse, épisodes : le popover de
 * macOS 26, calé AU-DESSUS du bord droit de la capsule (`.lgp-popover`).
 *
 * Ses panneaux d'avant suivaient le thème clair/sombre (fond `surface-dropdown`).
 * Posé sur la vidéo, le verre est sombre dans les deux thèmes : `.lgp-panel`
 * redéfinit LOCALEMENT les jetons du thème (texte, remplissages, liserés) en
 * valeurs opaques ou en noir à alpha — le contenu du panneau, inchangé, s'y
 * peint juste. Voir `playerGlassPanels.css`.
 *
 * L'apparition anime le CORPS (`transform-origin` en bas à droite : il naît des
 * boutons) ; la surface, elle, ne bouge pas — c'est elle que la région native
 * suit (cf. `GlassSurface`).
 */
export function GlassPanel({ className = "", bodyClassName = "", surfaceRef, role, children, ...aria }: GlassPanelProps) {
  const reduced = useReducedMotion();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 };
  return (
    <GlassSurface
      className={`lgp-panel lgp-popover ${className}`}
      group="player-panels"
      surfaceRef={surfaceRef}
      role={role}
      aria-label={aria["aria-label"]}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        className={`lgp-panel__body ${bodyClassName}`}
        initial={hidden}
        animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
        exit={{ ...hidden, transition: EXIT }}
      >
        {children}
      </motion.div>
    </GlassSurface>
  );
}
