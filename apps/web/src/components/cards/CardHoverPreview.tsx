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
          // Sortie qui REPOSE le panneau sur la carte (échelle 1, y 0) avant de
          // l'effacer. La version précédente le faisait disparaître là où il
          // était — 5 px plus haut et 3 % plus grand — pendant que la carte
          // réapparaissait à sa taille normale dessous : un dédoublement d'un
          // cinquième de seconde à chaque sortie de curseur.
          exit={{ opacity: 0, scale: 1, y: 0, transition: { duration: 0.14, ease: "easeOut" } }}
          // Ressort resserré (190 → 300) : le lift arrive maintenant en ~180 ms
          // au lieu de ~350, ce qui le remet dans la fourchette d'une
          // micro-interaction. Toujours aucun rebond — un dépassement, même
          // léger, se lit comme de l'agitation quand il se répète à chaque carte
          // survolée — d'où un amortissement conservé haut.
          transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.8 }}
          className="fixed z-40"
          style={{
            // Toujours le bord HAUT de la carte : le panneau part d'elle et n'en
            // bouge plus. En `down` il grandit vers le bas au fil du déroulé du
            // tiroir ; en `overlay` sa hauteur est celle de la carte, au pixel.
            top: placement.rect.top,
            left: placement.rect.left,
            width: placement.rect.width,
            height: placement.rect.height,
            maxHeight: `calc(100vh - 32px)`,
            // Origine au CENTRE de la VIGNETTE, pas du panneau : en `down` le
            // tiroir se déroule dessous, et un centre géométrique ferait dériver
            // l'image au fur et à mesure du déroulé.
            transformOrigin: placement.origin,
            // Rogné exactement comme la carte l'est par sa rangée. Le panneau
            // étant portalisé hors du conteneur qui rogne la carte, il
            // révélerait sinon une partie qu'elle ne montre pas, et passerait
            // par-dessus les flèches de défilement.
            clipPath: placement.rect.clip
              ? `inset(0 ${placement.rect.clip.right}px 0 ${placement.rect.clip.left}px)`
              : undefined,
            willChange: "transform",
          }}
        >
          {/* Liseré dégradé IDENTIQUE à celui de la carte (`CardFrame`), au
              même débord de 2 px. Le panneau reprend ainsi la signature exacte
              de ce qu'il remplace : rien ne change de main à l'ouverture. Il
              vit hors de la boîte `overflow-hidden`, sinon il serait rogné. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[2px] rounded-[14px]"
            style={{ background: "var(--card-ring-gradient)" }}
          />

          {/* Rayon `--radius-lg` (12 px) et non `--radius-xl` : c'est celui de
              la carte. Les 4 px d'écart se voyaient aux coins pendant toute la
              superposition.
              PAS de `backdrop-filter` : la vignette est opaque et le tiroir
              repose sur un fond opaque, il n'y avait donc rien à flouter — mais
              le flou d'arrière-plan forçait une passe de compositing sur une
              surface fixe de la taille du panneau, à l'image près de son
              ouverture. C'est le pire moment pour en demander une. */}
          <div
            className={`relative overflow-hidden rounded-[var(--radius-lg)] ${
              placement.rect.direction === "overlay" ? "h-full" : ""
            }`}
            style={{
              background: "var(--preview-panel-bg)",
              boxShadow: "var(--elev-card-hover), var(--card-ring-glow), var(--preview-panel-ring)",
            }}
          >
            <HoverPreviewBody
              item={item}
              cardImageUrl={cardImageUrl}
              direction={placement.rect.direction}
              onNavigate={onClose}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
