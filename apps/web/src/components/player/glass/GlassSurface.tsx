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
import { useIsPresent } from "framer-motion";
import { usePlayerGlassMode } from "./PlayerGlassContext";
import { useNativeGlassRegion, type GlassRegionOptions } from "./nativeGlassPort";
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
  /** Pour qui doit aussi tenir l'élément (clic à l'extérieur d'un menu…). */
  surfaceRef?: Ref<HTMLDivElement>;
}

export function GlassSurface({
  present = true, group = "player", variant = "regular", transition = NATIVE_FADE_MS, surfaceRef, className = "", children, ...rest
}: GlassSurfaceProps) {
  const mode = usePlayerGlassMode();
  const isPresent = useIsPresent();
  const chromeVisible = useContext(GlassChromeVisibleContext);
  const shown = present && isPresent && chromeVisible;
  const ref = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    if (typeof surfaceRef === "function") surfaceRef(node);
    else if (surfaceRef) (surfaceRef as { current: HTMLDivElement | null }).current = node;
  }, [surfaceRef]);

  useNativeGlassRegion(ref, { active: mode === "native" && shown, group, variant, transition });

  const preview = mode === "preview" ? " lgp-surface--preview" : "";
  return (
    <div ref={setRef} className={`lgp-surface${preview} ${className}`} data-lgp-present={shown} {...rest}>
      {children}
    </div>
  );
}
