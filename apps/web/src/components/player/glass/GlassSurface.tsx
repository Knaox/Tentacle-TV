/**
 * Une surface de verre du lecteur : l'élément du DOM qui porte une région
 * native.
 *
 * # Ce que la PAGE dessine ici : rien
 *
 * La matière (flou, réfraction, liseré, teinte) est celle de la vue native,
 * posée DERRIÈRE la page. La page n'y peint que le contenu — libellés et
 * icônes OPAQUES. Sur la surface à canal alpha de macOS, un blanc
 * semi-transparent rend gris (prémultiplication, mesuré : `videoShadow.ts`) ;
 * le noir et l'opaque, eux, se composent juste. Les jetons du lecteur
 * (`playerGlass.css`) n'emploient donc que ces deux familles.
 *
 * # Deux façons d'apparaître
 *
 * - Une surface FIXE (capsules, badges, attente) : la vue native entre et sort
 *   en FONDU, par son conteneur (`transition` > 0, lg-natif — l'alpha d'une
 *   NSGlassEffectView seule ne se voit pas, celui de son conteneur, si) ; son
 *   contenu se pose sur le ressort `morph` dans le même temps.
 * - Une surface qui BOUGE image par image (panneau qui naît de son bouton, coin
 *   bas-droit qui monte avec la capsule, bulle de la vignette, avis qui
 *   glissent) : `transition={0}`. Avec une transition, chaque déplacement serait
 *   rejoué au ressort côté natif et le verre courrait derrière la surface ; à
 *   zéro, la primitive (lg-tokens) relit le rectangle — transformations
 *   comprises — à chaque image et le verre le suit exactement.
 *
 * Une surface fixe BOUGE aussi quand la fenêtre change de taille (la barre du
 * bas suit le bord) : le temps du redimensionnement, sa transition tombe à
 * zéro (`windowResizing.ts`) — mesuré sans cela : le verre du bas sortait de
 * la fenêtre puis remontait au ressort, jusqu'à 160 pt de sa capsule, 300 ms.
 *
 * # Présence
 *
 * `present` faux (contrôles masqués) ou sortie en cours (`AnimatePresence` :
 * `useIsPresent`) → la région est RETIRÉE dès le début de la sortie. Rien de
 * natif ne reste derrière un contrôle qui n'est plus à l'écran.
 */

import { createContext, useCallback, useContext, useRef, type HTMLAttributes, type Ref } from "react";
import { motion, useIsPresent } from "framer-motion";
import type { GlassMorphProps } from "../../../theme/glass";
import { usePlayerGlassMode, usePlayerGlassRegionsAllowed } from "./PlayerGlassContext";
import { useNativeGlassRegion, type GlassRegionOptions } from "./nativeGlassPort";
import { PLAYER_FUSION_SPACING, PLAYER_GLASS_GROUP } from "./playerGlassFusion";
import { useWindowResizing } from "./windowResizing";
import "./playerGlass.css";

/**
 * Les contrôles du lecteur sont-ils à l'écran ? Fourni par l'habillage : un
 * panneau ouvert DANS la capsule s'efface avec elle, et sa région part aussi.
 */
export const GlassChromeVisibleContext = createContext(true);

/**
 * Le fondu natif d'une surface FIXE, en ms — celui du socle pour une
 * disparition (`--lg-duration-disappear`, 180 ms), à l'identique.
 */
export const NATIVE_FADE_MS = 180;

interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** La surface est à l'écran (contrôles affichés, panneau ouvert). */
  present?: boolean;
  group?: GlassRegionOptions["group"];
  variant?: GlassRegionOptions["variant"];
  /** Fondu natif à l'apparition et au retrait (ms) ; `NATIVE_FADE_MS` par défaut. */
  transition?: number;
  /** Distance de fusion du groupe (`playerGlassFusion.ts`) ; par défaut celle du groupe `player`. */
  spacing?: number;
  /**
   * Métamorphose (`glassMorphProps`, lg-physique) : la surface NAÎT du
   * rectangle de sa graine (`GlassMorphSeed`, dans le bouton) et y rentre à la
   * sortie — la région reste alors posée pendant la sortie, pour que le verre
   * natif suive la surface jusque dans le bouton.
   */
  morph?: GlassMorphProps;
  /** Pour qui doit aussi tenir l'élément (clic à l'extérieur d'un menu…). */
  surfaceRef?: Ref<HTMLDivElement>;
}

export function GlassSurface({
  present = true, group = PLAYER_GLASS_GROUP, variant = "regular", transition = NATIVE_FADE_MS, spacing, morph,
  surfaceRef, className = "", children, ...rest
}: GlassSurfaceProps) {
  const mode = usePlayerGlassMode();
  const isPresent = useIsPresent();
  const chromeVisible = useContext(GlassChromeVisibleContext);
  const regionsAllowed = usePlayerGlassRegionsAllowed();
  const resizing = useWindowResizing();
  // Une surface qui se métamorphose garde sa région pendant sa sortie : elle rentre dans son bouton.
  const shown = present && (isPresent || morph !== undefined) && chromeVisible;
  const ref = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    if (typeof surfaceRef === "function") surfaceRef(node);
    else if (surfaceRef) (surfaceRef as { current: HTMLDivElement | null }).current = node;
  }, [surfaceRef]);

  useNativeGlassRegion(ref, {
    active: mode === "native" && shown && regionsAllowed,
    group,
    variant,
    transition: resizing ? 0 : transition,
    spacing: spacing ?? (group === PLAYER_GLASS_GROUP ? PLAYER_FUSION_SPACING : undefined),
  });

  const preview = mode === "preview" ? " lgp-surface--preview" : "";
  // En sortie (`AnimatePresence`), une surface qui rentre dans son bouton est encore « à l'écran »
  // pour garder sa région — mais elle ne prend plus les clics (le bouton dessous les reçoit).
  const props = {
    ref: setRef, className: `lgp-surface${preview} ${className}`, "data-lgp-present": shown,
    "data-lgp-exiting": isPresent ? undefined : true,
  };
  if (morph) {
    return (
      <motion.div {...props} {...(rest as object)} layoutId={morph.layoutId} transition={morph.transition}>
        {children}
      </motion.div>
    );
  }
  return <div {...props} {...rest}>{children}</div>;
}
