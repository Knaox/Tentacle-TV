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
 * # Le cadre ne bouge pas, le contenu oui
 *
 * La région suit le RECTANGLE de cet élément. Une transformée animée dessus la
 * décalerait de la vue native le temps de l'animation (et une mesure prise au
 * montage garderait le décalage). Les apparitions animent donc l'enfant
 * (`.lgp-content`), jamais la surface ; l'apparition de la matière est celle
 * de la vue native.
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

interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** La surface est à l'écran (contrôles affichés, panneau ouvert). */
  present?: boolean;
  group?: GlassRegionOptions["group"];
  variant?: GlassRegionOptions["variant"];
  /** Fondu natif à l'apparition et au retrait (ms) ; `0` pour une surface qui se déplace. */
  transition?: number;
  /** Pour qui doit aussi tenir l'élément (clic à l'extérieur d'un menu…). */
  surfaceRef?: Ref<HTMLDivElement>;
}

export function GlassSurface({
  present = true, group = "player", variant = "regular", transition = 120, surfaceRef, className = "", children, ...rest
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
