/**
 * La géométrie de la lentille Chromium d'une surface : taille, rayon, biseau,
 * force, dispersion — de quoi calculer SA carte de réfraction
 * (`RefractionFilter`, @tentacle-tv/ui).
 *
 * Taille par `ResizeObserver` ; force, biseau et dispersion lus dans les
 * jetons `--lg-*` (jamais une valeur en dur ici). Une taille qui bouge encore
 * (fenêtre qu'on redimensionne, panneau qui s'ouvre) garde l'ancienne carte,
 * étirée, jusqu'à ce qu'elle se pose : la recalculer à chaque image coûterait
 * plus que l'écart ne se voit.
 */

import { useLayoutEffect, useState } from "react";

import {
  LENS_RESIZE_SETTLE_MS,
  lensBezelToken,
  type LiquidGlassLevel,
  type LiquidGlassShape,
} from "./surfaceModel";

export interface LensGeometry {
  width: number;
  height: number;
  radius: number;
  bezel: number;
  strength: number;
  dispersion: number;
}

const sameLens = (a: LensGeometry | null, b: LensGeometry): boolean =>
  a !== null &&
  a.width === b.width &&
  a.height === b.height &&
  a.radius === b.radius &&
  a.bezel === b.bezel &&
  a.strength === b.strength &&
  a.dispersion === b.dispersion;

const numberToken = (computed: CSSStyleDeclaration, name: string): number =>
  Number.parseFloat(computed.getPropertyValue(name)) || 0;

/** Lit la géométrie sur l'élément ; `null` s'il n'a pas de taille. */
export function readLensGeometry(
  element: HTMLElement,
  level: LiquidGlassLevel,
  shape: LiquidGlassShape,
): LensGeometry | null {
  const width = Math.round(element.offsetWidth);
  const height = Math.round(element.offsetHeight);
  if (width < 1 || height < 1) return null;
  const computed = getComputedStyle(element);
  const half = Math.min(width, height) / 2;
  const radius =
    shape === "capsule" || shape === "circle"
      ? half
      : Math.min(Number.parseFloat(computed.borderTopLeftRadius) || 0, half);
  return {
    width,
    height,
    radius: Math.round(radius),
    bezel: numberToken(computed, lensBezelToken(width, height)),
    strength: numberToken(computed, `--lg-refraction-${level}`),
    // La frange chromatique coûte deux passes : réservée au verre clair.
    dispersion: level === "clear" ? numberToken(computed, "--lg-dispersion") : 0,
  };
}

export function useLensGeometry(
  element: HTMLElement | null,
  enabled: boolean,
  level: LiquidGlassLevel,
  shape: LiquidGlassShape,
  radiusKey: string,
): LensGeometry | null {
  const [geometry, setGeometry] = useState<LensGeometry | null>(null);

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
    // `radiusKey` : un autre rayon demandé change la carte sans changer la taille.
  }, [element, enabled, level, shape, radiusKey]);

  return geometry;
}
