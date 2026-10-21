import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode, Ref } from "react";
import { glassMorphProps } from "../../../theme/glass";
import { GlassSurface } from "./GlassSurface";
import type { PlayerMorphId } from "./playerGlassFusion";
import "./playerGlassPanels.css";

interface GlassPanelProps {
  /** Classes de taille et de mise en page de l'habillage d'avant (largeur, hauteur max…). */
  className?: string;
  /** Classes du corps (remplissage, colonne…). */
  bodyClassName?: string;
  /** Le bouton dont le panneau NAÎT (sa graine, `GlassMorphSeed`, porte le même identifiant). */
  morphId: PlayerMorphId;
  surfaceRef?: Ref<HTMLDivElement>;
  role?: string;
  "aria-label"?: string;
  children: ReactNode;
}

/**
 * Un panneau du lecteur en verre — pistes, vitesse, épisodes : le popover de
 * macOS 26, calé AU-DESSUS du bord droit de la capsule (`.lgp-popover`).
 *
 * # Il naît de son bouton
 *
 * La SURFACE porte le `layoutId` de la graine du bouton (`glassMorphProps`,
 * décision du lot) : framer la fait partir du rectangle du bouton et la pose
 * à sa place sur le ressort `morph`. La région native suit ce rectangle image
 * par image : le verre sort de la capsule — même groupe, il s'y fond le temps
 * de la traverser (`playerGlassFusion.ts`) — puis s'en détache. À la sortie,
 * il y rentre. Le CONTENU, lui, ne s'étire pas : il n'apparaît qu'une fois la
 * forme presque posée, et s'efface d'abord à la sortie.
 *
 * # Île sombre
 *
 * Ses panneaux d'avant suivaient le thème (fond `surface-dropdown`). Posé sur
 * la vidéo, le verre est sombre dans les deux thèmes : `.lgp-panel` redéfinit
 * LOCALEMENT les jetons du thème (texte, remplissages, liserés) en valeurs
 * opaques ou en noir à alpha — le contenu, inchangé, s'y peint juste.
 */
export function GlassPanel({ className = "", bodyClassName = "", morphId, surfaceRef, role, children, ...aria }: GlassPanelProps) {
  const reduced = useReducedMotion();
  return (
    <GlassSurface
      className={`lgp-panel lgp-popover ${className}`}
      morph={glassMorphProps(morphId, reduced)}
      surfaceRef={surfaceRef}
      role={role}
      aria-label={aria["aria-label"]}
      onClick={(e) => e.stopPropagation()}
    >
      {/* L'enveloppe qui s'efface avec les contrôles : framer pose l'opacité EN
          LIGNE sur la surface (métamorphose) et sur le corps (apparition) — une
          règle CSS posée sur eux ne gagnerait jamais. */}
      <div className="lgp-panel__fade">
        <motion.div
          className={`lgp-panel__body ${bodyClassName}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: reduced ? { duration: 0.15 } : { duration: 0.16, delay: 0.12, ease: "easeOut" } }}
          exit={{ opacity: 0, transition: { duration: 0.08, ease: "easeIn" } }}
        >
          {children}
        </motion.div>
      </div>
    </GlassSurface>
  );
}
