/**
 * La géométrie de la lentille Chromium d'une surface, tenue à jour : de quoi
 * calculer SES cartes (`RefractionFilter`, @tentacle-tv/ui).
 *
 * Taille par `ResizeObserver` ; biseau, force, dispersion et lumière du bord
 * lus dans les jetons `--lg-*` (`lensTokens.ts`, jamais une valeur en dur
 * ici), relus quand le thème bascule (la lumière du bord en dépend). Une
 * taille qui bouge encore (fenêtre qu'on redimensionne, panneau qui s'ouvre)
 * garde l'ancienne carte, étirée, jusqu'à ce qu'elle se pose : la recalculer à
 * chaque image coûterait plus que l'écart ne se voit.
 */

import { useLayoutEffect, useState, useSyncExternalStore } from "react";

import { getScheme, subscribe as subscribeScheme } from "../colorScheme";
import { lensGeometryFrom, sameLens, type LensGeometry } from "./lensTokens";
import { LENS_RESIZE_SETTLE_MS, type LiquidGlassLevel, type LiquidGlassShape } from "./surfaceModel";

export type { LensGeometry } from "./lensTokens";

/** Lit la géométrie sur l'élément ; `null` s'il n'a pas de taille. */
export function readLensGeometry(
  element: HTMLElement,
  level: LiquidGlassLevel,
  shape: LiquidGlassShape,
): LensGeometry | null {
  const computed = getComputedStyle(element);
  return lensGeometryFrom(
    {
      width: element.offsetWidth,
      height: element.offsetHeight,
      cssRadius: Number.parseFloat(computed.borderTopLeftRadius) || 0,
      shape,
      level,
      pixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
    },
    (name) => computed.getPropertyValue(name),
  );
}

export function useLensGeometry(
  element: HTMLElement | null,
  enabled: boolean,
  level: LiquidGlassLevel,
  shape: LiquidGlassShape,
  radiusKey: string,
): LensGeometry | null {
  const [geometry, setGeometry] = useState<LensGeometry | null>(null);
  const scheme = useSyncExternalStore(subscribeScheme, getScheme, getScheme);

  useLayoutEffect(() => {
    if (!enabled || element === null) {
      setGeometry(null);
      return undefined;
    }
    const measure = (): void => {
      const next = readLensGeometry(element, level, shape);
      setGeometry((previous) => (next === null ? null : sameLens(previous, next) ? previous : next));
    };
    measure();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, LENS_RESIZE_SETTLE_MS);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
    // `radiusKey` : un autre rayon demandé change la carte sans changer la
    // taille ; `scheme` : la lumière du bord suit le thème.
  }, [element, enabled, level, shape, radiusKey, scheme]);

  return geometry;
}
