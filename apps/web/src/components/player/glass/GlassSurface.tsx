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
 * # Trois façons d'apparaître
 *
 * - Les CONTRÔLES (capsules du haut et du bas) se MÉTAMORPHOSENT (`collapse`) :
 *   repliés vers le pivot de leur ensemble, ils s'y fondent en une goutte qui se
 *   sépare en capsules ; la région suit la surface image par image et part
 *   quand la surface, repliée, ne se voit plus (`playerGlass.css`).
 * - Une surface FIXE (badges, attente) : la vue native entre et sort
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
 * `useIsPresent`) → la région est RETIRÉE dès le début de la sortie — à la fin
 * du repli pour une surface qui se replie. Rien de natif ne reste derrière un
 * contrôle qui n'est plus à l'écran.
 *
 * # Matière
 *
 * Verre CLAIR par défaut (HIG « Materials » : ce qui flotte sur la vidéo) ;
 * `variant="regular"` pour les surfaces de texte — panneaux, fiches, avis.
 */

import { createContext, useCallback, useContext, useRef, useState, type HTMLAttributes, type Ref } from "react";
import { motion, useIsPresent, useReducedMotion } from "framer-motion";
import type { GlassMorphProps } from "../../../theme/glass";
import { usePlayerGlassMode, usePlayerGlassRegionsAllowed } from "./PlayerGlassContext";
import { useNativeGlassRegion, useVideoBackdropTone, type GlassRegionOptions } from "./nativeGlassPort";
import { PLAYER_FUSION_SPACING, PLAYER_GLASS_GROUP } from "./playerGlassFusion";
import { useWindowResizing } from "./windowResizing";
import "./playerGlass.css";
import "./playerGlassCollapse.css";

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
  /**
   * Se REPLIE vers le pivot de son ensemble (`useCollapsePivots`) à l'apparition
   * et au retrait, au lieu d'un fondu : la métamorphose des contrôles.
   */
  collapse?: boolean;
  /**
   * Ses glyphes suivent le TON du dessous, mesuré sous la forme (`data-lg-tone`) :
   * sombres sur un dessous clair (la neige, un ciel blanc), clairs sinon.
   */
  adaptiveTone?: boolean;
  /** Pour qui doit aussi tenir l'élément (clic à l'extérieur d'un menu…). */
  surfaceRef?: Ref<HTMLDivElement>;
}

export function GlassSurface({
  present = true, group = PLAYER_GLASS_GROUP, variant = "clear", transition = NATIVE_FADE_MS, spacing, morph,
  collapse = false, adaptiveTone = false, surfaceRef, className = "", children, ...rest
}: GlassSurfaceProps) {
  const mode = usePlayerGlassMode();
  const isPresent = useIsPresent();
  const chromeVisible = useContext(GlassChromeVisibleContext);
  const regionsAllowed = usePlayerGlassRegionsAllowed();
  const resizing = useWindowResizing();
  const reducedMotion = useReducedMotion();
  // Repliée, la surface est suivie image par image ; en mouvement réduit, elle
  // part et revient en fondu natif, sans repli (`playerGlass.css`).
  const folding = collapse && reducedMotion !== true;
  // Une surface qui se métamorphose garde sa région pendant sa sortie : elle rentre dans son bouton.
  const shown = present && (isPresent || morph !== undefined) && chromeVisible;
  const ref = useRef<HTMLDivElement | null>(null);
  // L'élément lui-même (pas une ref) : `useBackdropTone` se réabonne quand il change.
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    setElement(node);
    if (typeof surfaceRef === "function") surfaceRef(node);
    else if (surfaceRef) (surfaceRef as { current: HTMLDivElement | null }).current = node;
  }, [surfaceRef]);

  useNativeGlassRegion(ref, {
    // Qui se replie garde sa région tant qu'elle se voit : c'est la fin du repli
    // (`visibility`) qui la retire, pas le premier instant du masquage.
    active: mode === "native" && (shown || collapse) && regionsAllowed,
    group,
    variant,
    transition: folding || resizing ? 0 : transition,
    spacing: spacing ?? (group === PLAYER_GLASS_GROUP ? PLAYER_FUSION_SPACING : undefined),
  });

  const tone = useVideoBackdropTone(element, adaptiveTone && mode === "native" && shown && regionsAllowed);

  const preview = mode === "preview" ? " lgp-surface--preview" : "";
  // En sortie (`AnimatePresence`), une surface qui rentre dans son bouton est encore « à l'écran »
  // pour garder sa région — mais elle ne prend plus les clics (le bouton dessous les reçoit).
  const props = {
    ref: setRef, className: `lgp-surface${preview} ${className}`, "data-lgp-present": shown,
    "data-lgp-exiting": isPresent ? undefined : true,
    "data-lgp-collapse": collapse ? "" : undefined,
    "data-lg-tone": adaptiveTone ? tone : undefined,
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
