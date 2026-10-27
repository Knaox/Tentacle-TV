import { motion } from "framer-motion";
import { useCallback, useRef, type ReactNode, type Ref } from "react";
import { GlassSurface } from "./GlassSurface";
import { MATERIALIZE_POPOVER } from "./playerGlassMaterialize";
import { usePopoverOrigin } from "./popoverOrigin";
import type { PlayerMorphId } from "./playerGlassFusion";
import "./playerGlassPanels.css";

interface GlassPanelProps {
  /** Classes de taille et de mise en page de l'habillage d'avant (largeur, hauteur max…). */
  className?: string;
  /** Classes du corps (remplissage, colonne…). */
  bodyClassName?: string;
  /** Le bouton dont le panneau NAÎT (il porte `popoverAnchorProps` du même identifiant). */
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
 * Il se MATÉRIALISE (lot lg8, à la place de la métamorphose de framer) : le
 * verre part d'un peu plus bas, à 88 %, depuis le CENTRE de son bouton
 * (`usePopoverOrigin`), et s'y pose pendant que son conteneur s'allume — son
 * contenu fait le même geste. À la fermeture, il y retourne, plus vite. Son
 * propre conteneur natif : il ne traverse plus la capsule.
 *
 * # Île sombre
 *
 * Ses panneaux d'avant suivaient le thème (fond `surface-dropdown`). Posé sur
 * la vidéo, le verre est sombre dans les deux thèmes : `.lgp-panel` redéfinit
 * LOCALEMENT les jetons du thème (texte, remplissages, liserés) en valeurs
 * opaques ou en noir à alpha — le contenu, inchangé, s'y peint juste.
 */
export function GlassPanel({ className = "", bodyClassName = "", morphId, surfaceRef, role, children, ...aria }: GlassPanelProps) {
  const own = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    own.current = node;
    if (typeof surfaceRef === "function") surfaceRef(node);
    else if (surfaceRef) (surfaceRef as { current: HTMLDivElement | null }).current = node;
  }, [surfaceRef]);
  const { origin, originCss } = usePopoverOrigin(morphId, own);
  return (
    <GlassSurface
      className={`lgp-panel lgp-popover ${className}`}
      materialize={0}
      motion={MATERIALIZE_POPOVER}
      origin={origin}
      originCss={originCss}
      variant="regular"
      surfaceRef={setRef}
      role={role}
      aria-label={aria["aria-label"]}
      onClick={(e) => e.stopPropagation()}
    >
      {/* L'enveloppe : l'enfant direct qui porte le geste (`playerGlassMaterialize.css`)
          et s'efface avec les contrôles. Le corps ne fait que TENIR le panneau monté
          le temps de sa sortie (`AnimatePresence` attend une animation de framer). */}
      <div className="lgp-panel__fade">
        <motion.div
          className={`lgp-panel__body ${bodyClassName}`}
          initial={false}
          exit={{ "--lgp-leaving": 1, transition: { duration: MATERIALIZE_POPOVER.exitMs / 1000 + 0.04 } } as never}
        >
          {children}
        </motion.div>
      </div>
    </GlassSurface>
  );
}
