/**
 * Ce que le verre natif calcule SANS AppKit : rectangles, teintes, styles,
 * ordre d'empilement. Vérifiable par les tests, sans fenêtre.
 */

import type { NativeGlassLevel, NativeGlassRegion } from "./protocol";

/** Un rectangle en points, origine en HAUT à gauche — celle de la page. */
export interface PointRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Un rectangle d'AppKit : origine en BAS à gauche. Même forme que `Rect` d'`objc.ts`. */
export interface AppKitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Des px CSS aux points de la fenêtre : le zoom de la page, rien d'autre.
 *
 * La vue web couvre toute la vue de contenu — le bandeau des feux est peint par
 * la page (`macosTitleBar.ts`) —, l'origine du viewport est donc celle du
 * contenu.
 */
export function toPoints(region: NativeGlassRegion, zoom: number): PointRect {
  const factor = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    x: region.x * factor,
    y: region.y * factor,
    width: region.width * factor,
    height: region.height * factor,
  };
}

/** Le rayon en points, jamais plus que la demi-hauteur ni la demi-largeur. */
export function toPointRadius(region: NativeGlassRegion, zoom: number): number {
  const factor = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const max = Math.min(region.width, region.height) * factor / 2;
  return Math.max(0, Math.min(region.radius * factor, max));
}

/**
 * Retourne l'axe vertical : AppKit compte depuis le BAS de la vue qui porte le
 * verre (`isFlipped` vaut faux sur la vue de contenu d'Electron, mesuré).
 */
export function toAppKitFrame(rect: PointRect, containerHeight: number): AppKitRect {
  return {
    x: rect.x,
    y: containerHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

/** Deux rectangles au centième de point près : en deçà, rien à écrire. */
export function sameRect(a: PointRect, b: PointRect): boolean {
  const close = (u: number, v: number): boolean => Math.abs(u - v) < 0.01;
  return close(a.x, b.x) && close(a.y, b.y) && close(a.width, b.width) && close(a.height, b.height);
}

/** Composantes sRGB, de 0 à 1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** `#RRGGBB` ou `#RRGGBBAA` ; `null` pour toute autre forme. */
export function parseTint(hex: string | null): Rgba | null {
  if (hex === null) return null;
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex);
  if (match === null) return null;
  const rgb = Number.parseInt(match[1] ?? "", 16);
  const alpha = match[2] === undefined ? 255 : Number.parseInt(match[2], 16);
  return {
    r: ((rgb >> 16) & 0xff) / 255,
    g: ((rgb >> 8) & 0xff) / 255,
    b: (rgb & 0xff) / 255,
    a: alpha / 255,
  };
}

/**
 * Le style d'AppKit (`NSGlassEffectViewStyle`) pour un niveau des jetons.
 *
 * AppKit n'en a que deux : `Regular` (0) et `Clear` (1). `tinted` et
 * `prominent` sont le verre ordinaire AVEC sa teinte — c'est la teinte qui les
 * distingue, et elle arrive par `tint`. Jamais une variante privée (`_variant`) :
 * le build du Mac App Store reçoit exactement ce code.
 */
export function nativeStyle(level: NativeGlassLevel): 0 | 1 {
  return level === "clear" ? 1 : 0;
}

/** Un élément empilable : sa profondeur, et son rang d'arrivée pour départager. */
export interface Stackable {
  readonly key: string;
  readonly z: number;
  readonly seq: number;
}

/**
 * La clé de l'élément qui doit se trouver JUSTE AU-DESSUS de `key`, ou `null`
 * s'il va tout en haut.
 *
 * Tri par profondeur croissante, puis par ordre d'arrivée : à profondeur égale,
 * le dernier venu passe au-dessus — comme deux frères en CSS.
 */
export function stackAnchor(items: readonly Stackable[], key: string): string | null {
  const sorted = [...items].sort((a, b) => a.z - b.z || a.seq - b.seq);
  const index = sorted.findIndex((item) => item.key === key);
  if (index < 0) return null;
  return sorted[index + 1]?.key ?? null;
}
