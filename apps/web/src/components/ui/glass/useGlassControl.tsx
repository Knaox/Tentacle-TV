/**
 * Ce que la primitive de lg-tokens apporte à une surface qui garde SA peau CSS
 * (`lg-menu`, `lg-sheet`, `lg-toast`, `lg-notice` — `lgOverlays.css`), quand
 * elle ne peut pas devenir elle-même une surface de la primitive (panneau de
 * `FloatingLayer`, feuille de `Modal` en `motion.div` animé…) :
 *  - la LENTILLE exacte : une carte de réfraction calculée pour la forme et la
 *    taille de l'élément, lumière du bord comprise (`useLensGeometry` +
 *    `RefractionFilter`), au lieu de la carte générique de `GlassFilters` ;
 *  - le TON du dessous (`data-lg-tone`, `useBackdropTone`), auquel les textes
 *    de la surface s'adaptent (`lgLegibility.css`) ;
 *  - le REFLET qui suit le pointeur (lg-physique : `useSpecularHighlight` et
 *    sa couche `GlassSpecular`, déplacée par `translate` — aucune peinture).
 *
 * Hors du mode natif : aucun écouteur, aucune mesure, aucun nœud en plus —
 * `props` est vide, `layers` est nul. Le rendu d'avant, au pixel près.
 *
 *     const glass = useGlassControl<HTMLDivElement>({ lens: "regular" });
 *     <div ref={glass.ref} {...glass.props} className="lg-menu …">{glass.layers}…</div>
 */

import { useCallback, useId, useMemo, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { RefractionFilter } from "@tentacle-tv/ui";

import { GlassSpecular, useBackdropTone, useLiquidGlassMode, useSpecularHighlight, type BackdropTone } from "../../../theme/glass";
import { useLensGeometry } from "../../../theme/glass/useLensGeometry";
import { useSurfaceTone } from "../../../theme/glass/useSurfaceTone";
import {
  lensFilterId,
  scaleAttributes,
  type LiquidGlassLevel,
  type LiquidGlassScale,
  type LiquidGlassShape,
} from "../../../theme/glass/surfaceModel";

export interface GlassControlOptions {
  /** Le niveau dont la lentille lit sa force (`--lg-refraction-*`) ; `false` : pas de lentille. */
  lens?: LiquidGlassLevel | false;
  /** La forme : elle fixe le rayon de la carte (une capsule = demi-hauteur). */
  shape?: LiquidGlassShape;
  /** Le reflet qui suit le pointeur. */
  specular?: boolean;
  /**
   * Le ton du dessous (`data-lg-tone`, mesuré par la coquille) : les textes de
   * la surface s'y adaptent (`lgLegibility.css`). Vrai par défaut.
   */
  tone?: boolean;
  /**
   * Le régime (`LiquidGlassScale`) : `surface` pour un grand verre (menu,
   * feuille, palette) — UN ton tenu, matériau épais (`data-lg-scale`).
   * Défaut `control`.
   */
  scale?: LiquidGlassScale;
  /**
   * @deprecated SANS EFFET depuis le lot lg2 : une surface garde UN ton.
   * Prendre `scale: "surface"`. Retiré en fin de lot.
   */
  bands?: boolean;
}

export interface GlassControl<T extends HTMLElement> {
  /** Ref à poser sur la surface. */
  ref: (element: T | null) => void;
  /** La même, pour une API qui attend un objet (`FloatingLayer.panelRef`). */
  refObject: RefObject<T | null>;
  /** À étaler sur la surface ; `style` se fusionne avec celui de l'appelant. */
  props: { style?: CSSProperties; "data-lgc-lens"?: ""; "data-lg-tone"?: BackdropTone; "data-lg-scale"?: "surface" };
  /** À rendre DANS la surface (filtre et reflet sont hors du flux). */
  layers: ReactNode;
}

export function useGlassControl<T extends HTMLElement>(options: GlassControlOptions): GlassControl<T> {
  const { lens = false, shape = "rounded", specular = false, tone: toneEnabled = true, scale } = options;
  const native = useLiquidGlassMode() === "native";
  const [element, setElement] = useState<T | null>(null);
  const specularRef = useSpecularHighlight<T>();

  const ref = useCallback(
    (node: T | null) => {
      setElement(node);
      specularRef(native && specular ? node : null);
    },
    [native, specular, specularRef],
  );
  const refObject = useMemo<RefObject<T | null>>(() => {
    let current: T | null = null;
    return {
      get current() { return current; },
      set current(node: T | null) { current = node; ref(node); },
    };
  }, [ref]);

  // Un contrôle suit le dessous ; une surface mesure à l'ouverture puis tient (lot lg2).
  const surface = scale === "surface";
  const controlTone = useBackdropTone(element, native && toneEnabled && !surface);
  const surfaceTone = useSurfaceTone(element, native && toneEnabled && surface);
  const tone = surface ? surfaceTone : controlTone;
  // Le ton relit la lentille : la lumière du bord en dépend (gain, éclat).
  const geometry = useLensGeometry(element, native && lens !== false, lens || "regular", shape, shape, tone);
  const filterId = lensFilterId(useId());

  if (!native) return { ref, refObject, props: {}, layers: null };
  return {
    ref,
    refObject,
    props: {
      ...(geometry ? { "data-lgc-lens": "" as const, style: { "--lgc-lens": `url(#${filterId})` } as CSSProperties } : {}),
      ...(toneEnabled ? { "data-lg-tone": tone } : {}),
      ...scaleAttributes(scale),
    },
    layers: (
      <>
        {geometry && <RefractionFilter id={filterId} {...geometry} />}
        {specular && <GlassSpecular />}
      </>
    ),
  };
}
