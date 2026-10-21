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
 * # La surface peut bouger : le verre la suit
 *
 * La primitive (lg-tokens) relit le rectangle de l'élément — transformations
 * comprises — à chaque image tant que quelque chose bouge. Une capsule qui se
 * pose sur son ressort (`.lgp-morph`) emmène donc le verre natif avec elle : il
 * grandit, il ne se contente pas d'apparaître. Le contenu, lui, n'apparaît
 * qu'en opacité (`.lgp-content`).
 *
 * # Le fondu natif : nul, pour l'instant
 *
 * `transition` > 0 demande à la vue native un fondu d'apparition et de retrait
 * — mesuré au banc le 21/10 : il ne se VOIT pas (le verre reste plein puis
 * saute à la fin du minuteur), et chaque déplacement s'anime d'autant (le verre
 * court derrière la surface). D'où `NATIVE_FADE_MS = 0` : le verre suit
 * exactement et part sans traîner. À remonter quand le socle aura un fondu
 * visible.
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
import "./playerGlass.css";

/**
 * Les contrôles du lecteur sont-ils à l'écran ? Fourni par l'habillage : un
 * panneau ouvert DANS la capsule s'efface avec elle, et sa région part aussi.
 */
export const GlassChromeVisibleContext = createContext(true);

/** Le fondu natif (ms) — voir l'en-tête : nul tant qu'il ne se voit pas. */
export const NATIVE_FADE_MS = 0;

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
    transition,
    spacing: spacing ?? (group === PLAYER_GLASS_GROUP ? PLAYER_FUSION_SPACING : undefined),
  });

  const preview = mode === "preview" ? " lgp-surface--preview" : "";
  const props = { ref: setRef, className: `lgp-surface${preview} ${className}`, "data-lgp-present": shown };
  if (morph) {
    return (
      <motion.div {...props} {...(rest as object)} layoutId={morph.layoutId} transition={morph.transition}>
        {children}
      </motion.div>
    );
  }
  return <div {...props} {...rest}>{children}</div>;
}
