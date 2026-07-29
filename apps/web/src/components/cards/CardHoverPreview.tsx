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
  /**
   * La fermeture est SÈCHE : pas de sortie animée (cf. `cut` dans
   * `useHoverPreview`). Le composant se retire alors ENTIÈREMENT de l'arbre —
   * `AnimatePresence` avec lui, et une `AnimatePresence` démontée ne peut plus
   * animer la sortie de personne. C'est le seul moyen sûr d'y arriver : framer
   * fige les props du dernier rendu de l'enfant qui sort, si bien qu'un `exit`
   * conditionnel serait toujours lu dans son état d'AVANT la fermeture.
   */
  cut?: boolean;
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
export function CardHoverPreview({ item, anchor, bounds, cardImageUrl, cut = false, onClose, panelHandlers }: CardHoverPreviewProps) {
  const placement = useMemo(() => {
    if (!anchor) return null;
    const rect = computePreviewRect(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      bounds,
    );
    return { rect, origin: previewOrigin(anchor, rect) };
  }, [anchor, bounds]);

  if (cut && !anchor) return null;

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
          // `z-30` et non `z-40`, qui était le défaut.
          //
          // `TopNav` est en `fixed z-40`, et le menu profil comme le panneau
          // Watch Together vivent DEDANS en `z-50` — un z-index qui n'a cours
          // que dans le contexte d'empilement de la nav, pas au niveau racine.
          // Face à ce panneau, également en `z-40` mais portalisé sur
          // `document.body`, c'est donc l'ORDRE DU DOM qui départageait : le
          // portail étant ajouté en dernier, l'aperçu passait par-dessus les
          // menus ouverts.
          //
          // L'échelle, du plus bas au plus haut : contenu de page 10-20,
          // APERÇU 30, navigation et ses menus 40-50, transition d'ouverture
          // 60, bandeaux 90, plein écran 100+. Un aperçu est la surface la plus
          // éphémère de toutes : sa place est en bas de cette liste.
          className="fixed z-30"
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
          {/* Rayon `--radius-lg` (12 px), celui de la carte. Élévation
              IDENTIQUE à `CardFrame` (`--elev-card-hover` seule) : rien ne
              change de main à l'ouverture. Ont disparu avec le contour des
              cartes le biseau de relief, le grain de pourtour et l'anneau de
              marque violet — un aperçu n'est pas un contrôle actif, son
              élévation suffit à le désigner.
              PAS de `backdrop-filter` : rien à flouter derrière un fond opaque,
              et le flou coûtait une passe de compositing à l'ouverture. */}
          <div
            className={`relative overflow-hidden rounded-[var(--radius-lg)] ${
              placement.rect.direction === "overlay" ? "h-full" : ""
            }`}
            style={{
              background: "var(--preview-panel-bg)",
              boxShadow: "var(--elev-card-hover)",
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
