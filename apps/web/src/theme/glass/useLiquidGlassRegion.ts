/**
 * `useLiquidGlassRegion(target, options)` — inscrit un élément comme région
 * de verre NATIF (macOS 26) : la coquille pose un NSGlassEffectView sous la
 * vue web, au rectangle de l'élément, et le suit (taille, défilement,
 * transformations, visibilité) jusqu'au démontage.
 *
 * Actif seulement en mode `native` (`<html data-liquid-glass="native">`) ;
 * partout ailleurs il ne fait rien et rend `false`. La page doit être
 * TRANSPARENTE à cet endroit, jusqu'à la fenêtre — sinon le verre est dessous
 * et ne se voit pas. `LiquidGlass backdrop="window"` s'en charge pour
 * l'élément lui-même ; ses ancêtres restent l'affaire de l'appelant.
 *
 * `target` : un `RefObject` (lu à l'effet) ou l'élément lui-même. Si
 * l'élément peut CHANGER (rendu conditionnel), passer l'élément, tenu dans un
 * état par une ref-callback : un `RefObject` ne prévient pas de son changement.
 */

import { useId, useLayoutEffect, useMemo, useRef, type RefObject } from "react";

import { useLiquidGlassMode } from "../useLiquidGlass";
import { nativeGlassBridge } from "../liquidGlassMode";
import type { RegionScheduler } from "./regionScheduler";
import { sharedRegionScheduler } from "./regionRuntime";
import { regionSpecOf, type LiquidGlassAppearance } from "./surfaceModel";
import type { RegionSpec } from "./regionGeometry";

export interface LiquidGlassRegionOptions extends LiquidGlassAppearance {
  /** `false` retire la région sans démonter l'élément. Défaut vrai. */
  enabled?: boolean;
}

type Target = RefObject<Element | null> | Element | null;

const isRefObject = (target: Target): target is RefObject<Element | null> =>
  target !== null && typeof target === "object" && "current" in target;

/**
 * Le geste de l'effet, à part pour être testé sans React : inscrit, puis rend
 * le désinscription.
 */
export function bindRegion(
  scheduler: RegionScheduler,
  id: string,
  element: Element,
  spec: RegionSpec,
): () => void {
  scheduler.register(id, element, spec);
  return () => scheduler.unregister(id);
}

export function useLiquidGlassRegion(target: Target, options: LiquidGlassRegionOptions = {}): boolean {
  const mode = useLiquidGlassMode();
  const reactId = useId();
  const id = useMemo(() => `lg-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const active = mode === "native" && options.enabled !== false && nativeGlassBridge() !== null;

  const { level, shape, tint, interactive, z } = options;
  const spec = useMemo(
    () => regionSpecOf({ level, shape, tint, interactive, z }),
    [level, shape, tint, interactive, z],
  );
  const specRef = useRef(spec);
  specRef.current = spec;

  // Passé directement, l'élément est la dépendance : son changement réinscrit.
  useLayoutEffect(() => {
    if (!active) return undefined;
    const node = isRefObject(target) ? target.current : target;
    const scheduler = sharedRegionScheduler();
    if (node === null || scheduler === null) return undefined;
    return bindRegion(scheduler, id, node, specRef.current);
  }, [active, id, target]);

  useLayoutEffect(() => {
    if (active) sharedRegionScheduler()?.update(id, spec);
  }, [active, id, spec]);

  return active;
}
