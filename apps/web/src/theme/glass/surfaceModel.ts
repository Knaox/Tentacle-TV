/**
 * Le modèle PUR d'une surface Liquid Glass : comment elle se rend selon le
 * mode, quelles classes et quels attributs elle porte. Aucun DOM, aucun
 * React — testé tel quel, et lu par `useLiquidGlassSurface`.
 */

import type { NativeGlassLevel } from "../../desktop/types";
import type { LiquidGlassMode } from "../liquidGlassMode";
import type { LiquidGlassShape, LiquidGlassTint, RegionSpec } from "./regionGeometry";

export type { LiquidGlassShape, LiquidGlassTint } from "./regionGeometry";
export type LiquidGlassLevel = NativeGlassLevel;
export type LiquidGlassRadius = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Ce qu'il y a DERRIÈRE la surface, dans la fenêtre :
 *  - `page`   : du contenu de la page (affiches, texte) — le cas courant ;
 *  - `window` : rien de la page — la page est transparente jusqu'à la
 *               fenêtre, et ce qu'on voit est la vidéo de mpv (fenêtre Metal
 *               SOUS la nôtre) ou le fond de la fenêtre.
 */
export type LiquidGlassBackdrop = "page" | "window";

/**
 * Le rendu effectif d'une surface :
 *  - `native`   : le verre de macOS (NSGlassEffectView) sous la vue web — il
 *                 ne voit que ce qui est SOUS la page, d'où `backdrop="window"` ;
 *  - `lens`     : la lentille de Chromium (réfraction SVG au biseau, flou,
 *                 saturation, spéculaire) — elle voit la page ;
 *  - `fallback` : le rendu d'avant, à l'identique.
 */
export type SurfaceRender = "native" | "lens" | "fallback";

export interface LiquidGlassAppearance {
  /** Variante du matériau. Défaut `regular`. */
  level?: LiquidGlassLevel;
  /** Forme. Défaut `rounded`. */
  shape?: LiquidGlassShape;
  /** Rayon d'une forme `rounded` (jetons `--lg-radius-*`). Défaut `md`. */
  radius?: LiquidGlassRadius;
  /** Teinte des niveaux `tinted` et `prominent`. Défaut `brand` (violet → rose). */
  tint?: LiquidGlassTint;
  /** Réagit au pointeur. */
  interactive?: boolean;
  /** Ordre d'empilement des verres natifs entre eux. Défaut 0. */
  z?: number;
  /**
   * Verre NATIF seulement : groupe de fusion (les régions d'un même groupe
   * fusionnent et se métamorphosent, NSGlassEffectContainerView), sa distance
   * de fusion en pt, et la durée des animations natives en ms.
   */
  group?: string;
  spacing?: number;
  transition?: number;
}

/** Hors du mode natif : toujours le rendu d'avant (CLAUDE.md, lot Liquid Glass). */
export function resolveSurfaceRender(
  mode: LiquidGlassMode,
  backdrop: LiquidGlassBackdrop,
): SurfaceRender {
  if (mode !== "native") return "fallback";
  return backdrop === "window" ? "native" : "lens";
}

/** La description d'une région native, valeurs par défaut posées. */
export function regionSpecOf(appearance: LiquidGlassAppearance): RegionSpec {
  return {
    level: appearance.level ?? "regular",
    shape: appearance.shape ?? "rounded",
    tint: appearance.tint ?? "brand",
    interactive: appearance.interactive === true,
    z: appearance.z ?? 0,
    group: appearance.group ?? null,
    spacing: appearance.spacing ?? null,
    transition: appearance.transition ?? null,
  };
}

/** Les attributs lus par `liquidGlassSurface.css` (rien en `fallback`). */
export function surfaceAttributes(
  appearance: LiquidGlassAppearance,
  render: SurfaceRender,
): Record<string, string> {
  if (render === "fallback") return {};
  const shape = appearance.shape ?? "rounded";
  const attributes: Record<string, string> = {
    "data-lg-render": render,
    "data-lg-level": appearance.level ?? "regular",
    "data-lg-shape": shape,
  };
  if (shape === "rounded") attributes["data-lg-radius"] = appearance.radius ?? "md";
  if (appearance.tint === "accent") attributes["data-lg-tint"] = "accent";
  if (appearance.interactive === true) attributes["data-lg-interactive"] = "";
  return attributes;
}

const join = (...parts: Array<string | undefined>): string =>
  parts.filter((part) => part !== undefined && part !== "").join(" ");

/**
 * Les classes : en `fallback`, celles d'avant (`className` + `fallbackClassName`,
 * rien de plus) ; sinon la surface de verre + la mise en page seule.
 */
export function surfaceClassName(
  render: SurfaceRender,
  className: string | undefined,
  fallbackClassName: string | undefined,
): string {
  return render === "fallback"
    ? join(className, fallbackClassName)
    : join("lg-surface", className);
}

/** Un identifiant de filtre valide dans `url(#…)`, tiré de `useId`. */
export function lensFilterId(reactId: string): string {
  return `lg-lens-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Une taille qui bouge encore ne recalcule pas sa carte à chaque image. */
export const LENS_RESIZE_SETTLE_MS = 120;
