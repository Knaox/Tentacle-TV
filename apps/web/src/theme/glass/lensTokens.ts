/**
 * De la surface mesurée et des jetons `--lg-*` à la géométrie de SA lentille :
 * taille, rayon, biseau, force, dispersion, lumière du bord. Pur : les jetons
 * arrivent par une fonction de lecture, testée sans navigateur.
 *
 * Le BISEAU suit le rayon, comme chez Apple : une pastille de 32 px n'a pas le
 * biseau d'un panneau. `ratio × rayon`, borné par `--lg-bezel-min|max`. La
 * FORCE est une fraction de ce biseau : un biseau étroit dévie peu.
 */

import type { SpecularLight } from "@tentacle-tv/ui";

import type { LiquidGlassLevel, LiquidGlassShape } from "./surfaceModel";

export interface LensGeometry {
  width: number;
  height: number;
  radius: number;
  bezel: number;
  /** Densité des cartes (celle de l'écran, 2 au plus). */
  pixelRatio: number;
  /** Décalage maximal, en px. */
  strength: number;
  dispersion: number;
  light: SpecularLight;
}

/** Lit un jeton sur l'élément (valeur calculée, `""` s'il manque). */
export type TokenReader = (name: string) => string;

const number = (read: TokenReader, name: string, fallback: number): number => {
  const value = Number.parseFloat(read(name));
  return Number.isFinite(value) ? value : fallback;
};

/** Le biseau d'une surface : ratio × rayon effectif, borné. */
export function lensBezel(radius: number, ratio: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, radius * ratio)));
}

/** La lumière du bord, d'après les jetons du thème courant. */
export function readSpecularLight(read: TokenReader): SpecularLight {
  return {
    angle: number(read, "--lg-light-angle", -18),
    facing: number(read, "--lg-specular-facing", 0.85),
    opposite: number(read, "--lg-specular-opposite", 0.42),
    base: number(read, "--lg-specular-base", 0.1),
    rim: number(read, "--lg-specular-rim", 1.5),
    glow: number(read, "--lg-specular-glow", 0.16),
  };
}

export interface MeasuredSurface {
  width: number;
  height: number;
  /** `border-top-left-radius` calculé, en px. */
  cssRadius: number;
  shape: LiquidGlassShape;
  level: LiquidGlassLevel;
  /** `devicePixelRatio` de l'écran (1 par défaut). */
  pixelRatio?: number;
}

/** La géométrie de la lentille ; `null` sans taille. */
export function lensGeometryFrom(surface: MeasuredSurface, read: TokenReader): LensGeometry | null {
  const width = Math.round(surface.width);
  const height = Math.round(surface.height);
  if (width < 1 || height < 1) return null;
  const half = Math.min(width, height) / 2;
  const radius =
    surface.shape === "capsule" || surface.shape === "circle"
      ? half
      : surface.shape === "rect"
        ? 0
        : Math.min(surface.cssRadius, half);
  const bezel = lensBezel(
    radius,
    number(read, "--lg-bezel-ratio", 0.6),
    number(read, "--lg-bezel-min", 8),
    // Jamais plus que la moitié de la plus petite dimension : le centre reste net.
    Math.min(number(read, "--lg-bezel-max", 22), Math.max(1, half - 1)),
  );
  const strength = number(read, `--lg-refraction-${surface.level}`, 0.6) * bezel;
  return {
    width,
    height,
    radius: Math.round(radius),
    bezel,
    pixelRatio: Math.min(2, Math.max(1, Math.round(surface.pixelRatio ?? 1))),
    strength: Math.round(strength * 10) / 10,
    // La frange chromatique coûte deux passes : réservée au verre clair.
    dispersion: surface.level === "clear" ? number(read, "--lg-dispersion", 0) : 0,
    light: readSpecularLight(read),
  };
}

/** Deux géométries identiques : la carte n'a pas à être refaite. */
export function sameLens(a: LensGeometry | null, b: LensGeometry): boolean {
  if (a === null) return false;
  const la = a.light;
  const lb = b.light;
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.radius === b.radius &&
    a.bezel === b.bezel &&
    a.pixelRatio === b.pixelRatio &&
    a.strength === b.strength &&
    a.dispersion === b.dispersion &&
    la.angle === lb.angle &&
    la.facing === lb.facing &&
    la.opposite === lb.opposite &&
    la.base === lb.base &&
    la.rim === lb.rim &&
    la.glow === lb.glow
  );
}
