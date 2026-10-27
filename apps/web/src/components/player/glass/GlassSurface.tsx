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
 * - Les CONTRÔLES et les POPOVERS se MATÉRIALISENT (`materialize`, lot lg8) :
 *   le verre monte de quelques points et « se condense » pendant que son
 *   conteneur s'allume, dans l'ordre des formes ; la page joue le même geste sur
 *   son contenu (`playerGlassMaterialize.ts`). La surface elle-même ne bouge pas :
 *   son rectangle est sa région.
 * - Une surface FIXE (badges, attente) : la vue native entre et sort
 *   en FONDU, par son conteneur (`transition` > 0, lg-natif — l'alpha d'une
 *   NSGlassEffectView seule ne se voit pas, celui de son conteneur, si) ; son
 *   contenu se pose sur le ressort `morph` dans le même temps.
 * - Une surface qui BOUGE image par image (coin bas-droit qui monte avec la capsule, bulle de la vignette, avis qui
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
 * `useIsPresent`) → la région est RETIRÉE dès le début de la sortie ; le natif
 * joue alors la sortie (fondu de son conteneur, et la descente d'une forme
 * matérialisée) puis retire la vue. Rien de natif ne reste derrière un contrôle
 * qui n'est plus à l'écran.
 *
 * # Matière
 *
 * Verre CLAIR par défaut (HIG « Materials » : ce qui flotte sur la vidéo) ;
 * `variant="regular"` pour les surfaces de texte — panneaux, fiches, avis.
 * Le verre clair porte, SOUS son contenu, l'atténuation que la HIG exige de lui
 * (`playerGlassDim.css`), dosée par le ton mesuré dessous ; le verre normal
 * s'adapte seul (mesuré : 91 sur la neige, 22 sur le noir, comme QuickTime).
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type HTMLAttributes, type Ref } from "react";
import { useIsPresent } from "framer-motion";
import { usePlayerGlassMode, usePlayerGlassRegionsAllowed } from "./PlayerGlassContext";
import { useNativeGlassRegion, useVideoBackdropTone, type GlassRegionOptions } from "./nativeGlassPort";
import { PLAYER_FUSION_SPACING, PLAYER_GLASS_GROUP } from "./playerGlassFusion";
import {
  CENTER_ORIGIN, MATERIALIZE, MATERIALIZE_REDUCED, materializeStyle, nativeMaterialize,
  type MaterializeMotion, type MaterializeOrigin,
} from "./playerGlassMaterialize";
import { useLiveReducedMotion } from "./useLiveReducedMotion";
import { useWindowResizing } from "./windowResizing";
import "./playerGlass.css";
import "./playerGlassDim.css";
import "./playerGlassMaterialize.css";

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
   * Se MATÉRIALISE à l'apparition et au retrait (`playerGlassMaterialize.ts`) :
   * la valeur est l'ORDRE de la forme (0, 1, 2…), qui décale son entrée. Une
   * forme matérialisée a son PROPRE conteneur natif (`group` ignoré) : son fondu
   * est le sien. Elle ne peint rien elle-même et n'est jamais transformée — ses
   * enfants directs, `::before` et `::after` portent le geste.
   */
  materialize?: number;
  /** Le geste (`MATERIALIZE` par défaut ; `MATERIALIZE_POPOVER` pour un popover). */
  motion?: MaterializeMotion;
  /** L'origine de l'échelle (fractions de la forme) ; `originCss` la dit à la page quand elle la connaît mieux. */
  origin?: MaterializeOrigin;
  originCss?: string;
  /**
   * Mesure le TON du dessous sous la forme (`data-lg-tone`, la vidéo seule) : son
   * ATTÉNUATION le suit (`playerGlassDim.css`), plus forte sur un dessous clair.
   * Par défaut pour le verre CLAIR, qui en a besoin ; le verre normal s'adapte
   * seul et ne prend aucune atténuation (mesuré, lg3).
   */
  adaptiveTone?: boolean;
  /** Pour qui doit aussi tenir l'élément (clic à l'extérieur d'un menu…). */
  surfaceRef?: Ref<HTMLDivElement>;
}

export function GlassSurface({
  present = true, group = PLAYER_GLASS_GROUP, variant = "clear", transition = NATIVE_FADE_MS, spacing,
  materialize, motion = MATERIALIZE, origin = CENTER_ORIGIN, originCss, adaptiveTone, surfaceRef, className = "",
  style, children, ...rest
}: GlassSurfaceProps) {
  const mode = usePlayerGlassMode();
  const isPresent = useIsPresent();
  const chromeVisible = useContext(GlassChromeVisibleContext);
  const regionsAllowed = usePlayerGlassRegionsAllowed();
  const resizing = useWindowResizing();
  const reducedMotion = useLiveReducedMotion();
  const shown = present && isPresent && chromeVisible;
  // Le geste, une fois pour la coquille et pour la page (mouvement réduit : un fondu).
  const gesture = materialize === undefined ? null : reducedMotion ? MATERIALIZE_REDUCED : motion;
  const native = useMemo(
    () => (gesture === null ? undefined : nativeMaterialize(gesture, materialize ?? 0, origin)),
    [gesture, materialize, origin],
  );
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
    active: mode === "native" && shown && regionsAllowed,
    group: native === undefined ? group : undefined,
    variant,
    transition: resizing ? 0 : gesture?.enterMs ?? transition,
    spacing: native !== undefined ? undefined : spacing ?? (group === PLAYER_GLASS_GROUP ? PLAYER_FUSION_SPACING : undefined),
    materialize: native,
  });

  const measured = adaptiveTone ?? variant === "clear";
  const tone = useVideoBackdropTone(element, measured && mode === "native" && shown && regionsAllowed);

  const preview = mode === "preview" ? " lgp-surface--preview" : "";
  const surfaceStyle = native === undefined || gesture === null ? style : { ...materializeStyle(native, gesture.enterMs, originCss), ...style };
  return (
    <div
      ref={setRef}
      className={`lgp-surface${preview} ${className}`}
      data-lgp-present={shown}
      data-lgp-exiting={isPresent ? undefined : true}
      data-lgp-materialize={native === undefined ? undefined : ""}
      data-lg-tone={measured ? tone : undefined}
      data-lgp-variant={variant}
      style={surfaceStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
