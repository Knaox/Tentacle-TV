/**
 * Color manipulation helpers for the admin brand picker. Pure functions —
 * no DOM. Used to derive sibling brand tokens (rgb triplet, lighter and
 * darker hex variants) from a single picked base color.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

export function hexToRgb(hex: string): RGB | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToTriplet({ r, g, b }: RGB): string {
  return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = h / 360;
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) {
    const v = ln * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: hue2rgb(p, q, hn + 1 / 3) * 255,
    g: hue2rgb(p, q, hn) * 255,
    b: hue2rgb(p, q, hn - 1 / 3) * 255,
  };
}

/** Adjust the lightness component of a hex color by `delta` (in [-100, 100]). */
export function shiftLightness(hex: string, delta: number): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  const nextHsl: HSL = {
    h: hsl.h,
    s: hsl.s,
    l: clamp(hsl.l + delta, 0, 100),
  };
  return rgbToHex(hslToRgb(nextHsl));
}

export interface DerivedBrandTokens {
  base: string;
  rgb: string;
  light: string;
  dark: string;
}

/**
 * Derive the four brand token values from a single picked hex color.
 * - `base`  : the input itself (uppercased).
 * - `rgb`   : "R, G, B" triplet for `rgba(var(--brand-rgb), X)` consumers.
 * - `light` : lightness shifted +12 (clamped 0–100).
 * - `dark`  : lightness shifted -12 (clamped 0–100).
 *
 * The default brand (#8B5CF6) maps to:
 *   light=#AC8AFA, dark=#702AE6  (close to the existing #A78BFA / #7C3AED).
 */
export function deriveBrandTokens(hex: string): DerivedBrandTokens | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const base = rgbToHex(rgb);
  return {
    base,
    rgb: rgbToTriplet(rgb),
    light: shiftLightness(base, 12) ?? base,
    dark: shiftLightness(base, -12) ?? base,
  };
}
