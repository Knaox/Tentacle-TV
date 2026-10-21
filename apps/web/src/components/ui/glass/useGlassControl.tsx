/**
 * Ce que la primitive de lg-tokens apporte à une surface, branché sur un
 * composant qui garde SA peau (`lg-btn`, `lg-menu`… — `lgControls.css`,
 * `lgOverlays.css`) :
 *  - la LENTILLE exacte : une carte de réfraction calculée pour la forme et
 *    la taille de l'élément (`useLensGeometry` + `RefractionFilter`), au lieu
 *    de la carte générique étirée de `GlassFilters` ;
 *  - le REFLET qui suit le pointeur (lg-physique : `useSpecularHighlight` et
 *    sa couche `GlassSpecular`, déplacée par `translate` — aucune peinture).
 *
 * Hors du mode natif : aucun écouteur, aucune mesure, aucun nœud en plus —
 * `props` est vide, `layers` est nul. Le rendu d'avant, au pixel près.
 *
 *     const glass = useGlassControl<HTMLButtonElement>({ lens: "prominent", shape: "capsule", specular: true });
 *     <button ref={glass.ref} {...glass.props} className="lg-btn-primary …">{glass.layers}…</button>
 */

import { useCallback, useId, useMemo, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { RefractionFilter } from "@tentacle-tv/ui";

import { GlassSpecular, useLiquidGlassMode, useSpecularHighlight } from "../../../theme/glass";
import { useLensGeometry } from "../../../theme/glass/useLensGeometry";
import { lensFilterId, type LiquidGlassLevel, type LiquidGlassShape } from "../../../theme/glass/surfaceModel";

export interface GlassControlOptions {
  /** Le niveau dont la lentille lit sa force (`--lg-refraction-*`) ; `false` : pas de lentille. */
  lens?: LiquidGlassLevel | false;
  /** La forme : elle fixe le rayon de la carte (une capsule = demi-hauteur). */
  shape?: LiquidGlassShape;
  /** Le reflet qui suit le pointeur. */
  specular?: boolean;
}

export interface GlassControl<T extends HTMLElement> {
  /** Ref à poser sur la surface. */
  ref: (element: T | null) => void;
  /** La même, pour une API qui attend un objet (`FloatingLayer.panelRef`). */
  refObject: RefObject<T | null>;
  /** À étaler sur la surface ; `style` se fusionne avec celui de l'appelant. */
  props: { style?: CSSProperties; "data-lgc-lens"?: "" };
  /** À rendre DANS la surface (filtre et reflet sont hors du flux). */
  layers: ReactNode;
}

export function useGlassControl<T extends HTMLElement>(options: GlassControlOptions): GlassControl<T> {
  const { lens = false, shape = "rounded", specular = false } = options;
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

  const geometry = useLensGeometry(element, native && lens !== false, lens || "regular", shape, shape);
  const filterId = lensFilterId(useId());

  if (!native) return { ref, refObject, props: {}, layers: null };
  return {
    ref,
    refObject,
    props: geometry
      ? { "data-lgc-lens": "", style: { "--lgc-lens": `url(#${filterId})` } as CSSProperties }
      : {},
    layers: (
      <>
        {geometry && <RefractionFilter id={filterId} {...geometry} />}
        {specular && <GlassSpecular />}
      </>
    ),
  };
}
