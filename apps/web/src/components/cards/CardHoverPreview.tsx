import { useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { HoverPreviewBody } from "./HoverPreviewBody";
import {
  computePreviewRect,
  previewOrigin,
  type AnchorRect,
  type PreviewBounds,
} from "./hoverPreviewGeometry";

interface CardHoverPreviewProps {
  item: MediaItem;
  /** Position de la carte, figée à l'ouverture. `null` = panneau fermé. */
  anchor: AnchorRect | null;
  /** Bornes de la rangée — évitent les flèches là où elles existent vraiment. */
  bounds?: PreviewBounds;
  /**
   * Image EXACTE affichée par la carte. Sur une carte verticale, le panneau
   * la reprend telle quelle : l'affiche du panneau se superpose alors
   * pixel pour pixel à celle de la carte, sans le moindre saut.
   */
  cardImageUrl: string;
  onClose: () => void;
  panelHandlers: { onMouseEnter: () => void; onMouseLeave: () => void };
}

/**
 * Panneau d'aperçu au survol, rendu dans un PORTAIL sur `document.body`.
 *
 * C'est tout l'intérêt du portail : une rangée est un conteneur
 * `overflow-x: auto`, et CSS impose alors un `overflow-y` calculé — n'importe
 * quel panneau resté dans le flux serait rogné en haut et en bas. Sorti de
 * l'arbre et positionné en `fixed`, il déborde librement, sans jamais
 * repousser ni chevaucher les cartes voisines.
 *
 * Corollaire : les coordonnées sont figées à l'ouverture. `useHoverPreview`
 * ferme donc au moindre défilement ou redimensionnement, plutôt que de suivre
 * l'ancre frame par frame.
 */
export function CardHoverPreview({ item, anchor, bounds, cardImageUrl, onClose, panelHandlers }: CardHoverPreviewProps) {
  const placement = useMemo(() => {
    if (!anchor) return null;
    const rect = computePreviewRect(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      bounds,
    );
    return { rect, origin: previewOrigin(anchor, rect) };
  }, [anchor, bounds]);

  return createPortal(
    <AnimatePresence>
      {placement && (
        <motion.div
          role="group"
          aria-label={item.Name}
          data-preview-panel
          {...panelHandlers}
          // Départ à l'échelle 1, opacité 1 : le panneau reprend l'image de la
          // carte, à sa taille et à sa place. Il n'y a donc RIEN à faire
          // apparaître — un fondu ferait clignoter une image déjà à l'écran.
          // Il ne reste que le lift, identique à l'ancien survol de carte.
          initial={{ opacity: 1, scale: 1, y: 0 }}
          animate={{ opacity: 1, scale: 1.03, y: -5 }}
          exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
          // Ressort volontairement plus lent et plus amorti que `springSoft` :
          // le lift doit accompagner le regard, pas claquer. Aucun rebond
          // (damping élevé) — un dépassement, même léger, se lit comme de
          // l'agitation quand il se répète à chaque carte survolée.
          transition={{ type: "spring", stiffness: 190, damping: 26, mass: 1 }}
          className="fixed z-40 overflow-hidden rounded-[var(--radius-xl)]"
          style={{
            top: placement.rect.top,
            left: placement.rect.left,
            width: placement.rect.width,
            maxHeight: `calc(100vh - 32px)`,
            // Origine au CENTRE de la vignette, pas au centre du panneau : le
            // bloc d'infos se déroule sous elle, un centre géométrique ferait
            // dériver l'image vers le haut au fur et à mesure du déroulé.
            transformOrigin: "50% 25%",
            background: "var(--preview-panel-bg)",
            boxShadow: "var(--shadow-modal), var(--preview-panel-ring)",
            backdropFilter: "blur(var(--blur-dropdown))",
            WebkitBackdropFilter: "blur(var(--blur-dropdown))",
          }}
        >
          <HoverPreviewBody item={item} cardImageUrl={cardImageUrl} onNavigate={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
