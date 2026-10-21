/**
 * Ce qu'une région de verre natif dit à la coquille : sa boîte dans le
 * viewport, son rayon, sa teinte — mesurés sur l'élément de la page.
 *
 * Deux temps, pour le coût : le STYLE (rayon des coins, teinte, lus dans les
 * feuilles par `getComputedStyle`) ne se relit qu'à l'inscription, au
 * changement de thème et de taille ; la GÉOMÉTRIE (`getBoundingClientRect`,
 * transformations comprises) se relit à chaque image tant que quelque chose
 * bouge. Une région cachée, transparente ou sortie de l'écran n'est pas
 * envoyée : la coquille ne garde que ce qui se voit.
 */

import type { NativeGlassLevel, NativeGlassRegion } from "../../desktop/types";

export type LiquidGlassShape = "capsule" | "rounded" | "circle" | "rect";
export type LiquidGlassTint = "brand" | "accent";

/** Ce qui décrit une région, hors géométrie. */
export interface RegionSpec {
  level: NativeGlassLevel;
  shape: LiquidGlassShape;
  tint: LiquidGlassTint;
  interactive: boolean;
  z: number;
  /** Groupe de fusion natif (NSGlassEffectContainerView), ou `null`. */
  group: string | null;
  /** Distance de fusion du groupe en pt, ou `null` (celle d'AppKit). */
  spacing: number | null;
  /** Animation native d'apparition, de déplacement et de retrait en ms, ou `null`. */
  transition: number | null;
}

/** Ce que les feuilles disent de l'élément. */
export interface RegionStyle {
  /** Rayon des coins à l'échelle 1, en px CSS. */
  radius: number;
  /** Teinte `#RRGGBBAA`, ou `null`. */
  tint: string | null;
}

export interface Viewport {
  width: number;
  height: number;
}

/** La boîte mesurée, et la largeur de mise en page (avant transformation). */
export interface MeasuredBox {
  x: number;
  y: number;
  width: number;
  height: number;
  layoutWidth: number;
}

/** Le jeton de teinte native d'une région (`liquidGlassTokens.css`). */
export function nativeTintToken(spec: Pick<RegionSpec, "level" | "tint">): string {
  const tinted = spec.level === "tinted" || spec.level === "prominent";
  return tinted && spec.tint === "accent"
    ? `--lg-native-tint-${spec.level}-accent`
    : `--lg-native-tint-${spec.level}`;
}

const hex2 = (value: number): string =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0").toUpperCase();

/**
 * Une couleur CSS calculée → `#RRGGBBAA`, ou `null` si elle est transparente
 * ou illisible. Couvre ce que rend `getComputedStyle` d'une propriété
 * personnalisée : `rgb()`, `rgba()` (virgules ou espaces), `#rgb`, `#rrggbb`,
 * `#rrggbbaa`, `transparent`.
 */
export function cssColorToHex(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (text === "" || text === "transparent" || text === "none") return null;

  if (text.startsWith("#")) {
    const digits = text.slice(1);
    const full =
      digits.length === 3 || digits.length === 4
        ? digits.split("").map((d) => d + d).join("")
        : digits;
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(full)) return null;
    const withAlpha = full.length === 6 ? `${full}ff` : full;
    return withAlpha.endsWith("00") ? null : `#${withAlpha.toUpperCase()}`;
  }

  const match = /^rgba?\(([^)]*)\)$/.exec(text);
  if (match === null) return null;
  const parts = match[1].split(/[\s,/]+/).filter((part) => part !== "");
  if (parts.length < 3) return null;
  const channels = parts.slice(0, 3).map(Number);
  if (channels.some((c) => !Number.isFinite(c))) return null;
  const alphaText = parts[3];
  const alpha =
    alphaText === undefined
      ? 1
      : alphaText.endsWith("%")
        ? Number(alphaText.slice(0, -1)) / 100
        : Number(alphaText);
  if (!Number.isFinite(alpha) || alpha <= 0) return null;
  return `#${channels.map(hex2).join("")}${hex2(alpha * 255)}`;
}

/** Au centième de px : assez fin pour un mouvement fluide, stable au repos. */
const round = (value: number): number => Math.round(value * 100) / 100;

/** La région envoyée pour une boîte, ou `null` si elle ne se voit pas. */
export function regionFromBox(
  id: string,
  box: MeasuredBox,
  spec: RegionSpec,
  style: RegionStyle,
  viewport: Viewport,
): NativeGlassRegion | null {
  if (box.width < 1 || box.height < 1) return null;
  const outside =
    box.x + box.width <= 0 ||
    box.y + box.height <= 0 ||
    box.x >= viewport.width ||
    box.y >= viewport.height;
  if (outside) return null;

  // Une surface agrandie par une transformation garde des coins à l'échelle.
  const scale = box.layoutWidth > 0 ? box.width / box.layoutWidth : 1;
  const half = Math.min(box.width, box.height) / 2;
  const radius =
    spec.shape === "capsule" || spec.shape === "circle"
      ? half
      : spec.shape === "rect"
        ? 0
        : Math.min(style.radius * scale, half);

  return {
    id,
    x: round(box.x),
    y: round(box.y),
    width: round(box.width),
    height: round(box.height),
    radius: round(radius),
    level: spec.level,
    tint: style.tint,
    interactive: spec.interactive,
    z: spec.z,
    // Champs facultatifs du pont : absents plutôt que `null`.
    ...(spec.group !== null ? { group: spec.group } : {}),
    ...(spec.spacing !== null ? { spacing: spec.spacing } : {}),
    ...(spec.transition !== null ? { transition: spec.transition } : {}),
  };
}

/** Deux régions identiques à l'envoi près : rien à redire à la coquille. */
export function sameRegion(a: NativeGlassRegion, b: NativeGlassRegion): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.radius === b.radius &&
    a.level === b.level &&
    a.tint === b.tint &&
    a.interactive === b.interactive &&
    a.z === b.z &&
    a.group === b.group &&
    a.spacing === b.spacing &&
    a.transition === b.transition
  );
}

type VisibilityCheck = (options?: {
  opacityProperty?: boolean;
  visibilityProperty?: boolean;
}) => boolean;

/** L'élément se voit-il ? Ni `display: none`, ni caché, ni transparent (ancêtres compris). */
export function isRendered(element: Element): boolean {
  if (!element.isConnected) return false;
  const check = (element as Element & { checkVisibility?: VisibilityCheck }).checkVisibility;
  if (typeof check !== "function") return true;
  return check.call(element, { opacityProperty: true, visibilityProperty: true });
}

/** Lit dans les feuilles le rayon et la teinte de l'élément. */
export function readRegionStyle(element: Element, spec: RegionSpec): RegionStyle {
  const computed = getComputedStyle(element);
  return {
    radius: Number.parseFloat(computed.borderTopLeftRadius) || 0,
    tint: cssColorToHex(computed.getPropertyValue(nativeTintToken(spec))),
  };
}

/** Mesure l'élément : la région à envoyer, ou `null` s'il ne se voit pas. */
export function measureRegion(
  id: string,
  element: Element,
  spec: RegionSpec,
  style: RegionStyle,
  viewport: Viewport,
): NativeGlassRegion | null {
  if (!isRendered(element)) return null;
  const rect = element.getBoundingClientRect();
  const layoutWidth = (element as HTMLElement).offsetWidth ?? 0;
  return regionFromBox(
    id,
    { x: rect.x, y: rect.y, width: rect.width, height: rect.height, layoutWidth },
    spec,
    style,
    viewport,
  );
}
