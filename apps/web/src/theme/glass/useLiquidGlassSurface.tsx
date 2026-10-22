/**
 * `useLiquidGlassSurface(options)` — tout ce qu'un élément doit porter pour
 * être une surface Liquid Glass, à étaler sur N'IMPORTE quel élément, un
 * `motion.div` de framer-motion compris :
 *
 *     const glass = useLiquidGlassSurface({
 *       level: "regular", shape: "capsule", backdrop: "page",
 *       className: "fixed top-4 flex gap-2 px-4",          // mise en page, toujours
 *       fallbackClassName: "bg-black/60 backdrop-blur-xl", // le rendu d'avant
 *     });
 *     return <motion.nav {...glass.props}>{glass.layers}{children}</motion.nav>;
 *
 * `glass.layers` doit être rendu DANS l'élément (le filtre de la lentille).
 * `<LiquidGlass>` fait exactement ceci pour un élément simple.
 */

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import { RefractionFilter } from "@tentacle-tv/ui";

import { useLiquidGlassMode } from "../useLiquidGlass";
import { useBackdropTone } from "./useBackdropTone";
import { useLensGeometry } from "./useLensGeometry";
import { useLiquidGlassRegion } from "./useLiquidGlassRegion";
import {
  lensFilterId,
  resolveSurfaceRender,
  surfaceAttributes,
  surfaceClassName,
  type LiquidGlassAppearance,
  type LiquidGlassBackdrop,
  type SurfaceRender,
} from "./surfaceModel";

export interface LiquidGlassSurfaceOptions extends LiquidGlassAppearance {
  /** Ce qu'il y a derrière (voir `LiquidGlassBackdrop`). Défaut `page`. */
  backdrop?: LiquidGlassBackdrop;
  /** Mise en page — appliquée dans TOUS les modes. Aucune couleur, aucun flou ici. */
  className?: string;
  style?: CSSProperties;
  /** Le rendu d'avant (fond, flou, liseré, ombre) — seulement hors du mode natif. */
  fallbackClassName?: string;
  fallbackStyle?: CSSProperties;
  /** Ref de l'appelant, réunie à celle de la surface. */
  ref?: Ref<HTMLElement>;
  /**
   * @deprecated SANS EFFET depuis le lot lg2 : une surface garde UN ton
   * (Apple ne pose jamais de bandes). Un grand verre prend `scale: "surface"`.
   * Retiré en fin de lot.
   */
  bands?: boolean;
}

export interface LiquidGlassSurfaceProps {
  ref: (element: HTMLElement | null) => void;
  className: string | undefined;
  style: CSSProperties | undefined;
  [attribute: `data-lg-${string}`]: string;
}

export interface LiquidGlassSurface {
  render: SurfaceRender;
  props: LiquidGlassSurfaceProps;
  /** À rendre en premier enfant (le filtre de la lentille, sinon rien). */
  layers: ReactNode;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref !== null && ref !== undefined) (ref as { current: T | null }).current = value;
}

export function useLiquidGlassSurface(options: LiquidGlassSurfaceOptions): LiquidGlassSurface {
  const { backdrop = "page", className, style, fallbackClassName, fallbackStyle, ref: outerRef } = options;
  const appearance: LiquidGlassAppearance = {
    level: options.level,
    shape: options.shape,
    radius: options.radius,
    tint: options.tint,
    interactive: options.interactive,
    scale: options.scale,
    z: options.z,
    group: options.group,
    spacing: options.spacing,
    transition: options.transition,
  };
  const render = resolveSurfaceRender(useLiquidGlassMode(), backdrop);

  // L'élément n'est tenu en ÉTAT (donc un rendu de plus) qu'hors du rendu
  // d'avant : en `fallback`, la surface ne coûte rien de plus qu'avant.
  const nodeRef = useRef<HTMLElement | null>(null);
  const renderRef = useRef(render);
  renderRef.current = render;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (renderRef.current !== "fallback") setElement(node);
      assignRef(outerRef, node);
    },
    [outerRef],
  );
  useLayoutEffect(() => {
    setElement(render === "fallback" ? null : nodeRef.current);
  }, [render]);

  useLiquidGlassRegion(element, { ...appearance, enabled: render === "native" });

  const level = appearance.level ?? "regular";
  const shape = appearance.shape ?? "rounded";
  // Le ton de ce qui est dessous : la polarité des glyphes et la lumière du
  // bord (lentille de page ; le verre natif s'adapte seul).
  const tone = useBackdropTone(element, render === "lens");
  const lens = useLensGeometry(element, render === "lens", level, shape, appearance.radius ?? "md", tone);
  const filterId = lensFilterId(useId());

  if (render === "fallback") {
    const merged = fallbackStyle || style ? { ...fallbackStyle, ...style } : undefined;
    return {
      render,
      props: { ref, className: surfaceClassName(render, className, fallbackClassName) || undefined, style: merged },
      layers: null,
    };
  }

  const lensStyle =
    render === "lens" && lens !== null
      ? ({ "--lg-lens": `url(#${filterId})` } as CSSProperties)
      : undefined;
  return {
    render,
    props: {
      ref,
      className: surfaceClassName(render, className, undefined),
      style: lensStyle || style ? { ...style, ...lensStyle } : undefined,
      ...surfaceAttributes(appearance, render),
      ...(render === "lens" ? { "data-lg-tone": tone } : {}),
    },
    layers:
      render === "lens" && lens !== null ? <RefractionFilter id={filterId} {...lens} /> : null,
  };
}
