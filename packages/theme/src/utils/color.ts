/**
 * Petits utilitaires couleur pour dériver la palette claire des hues de
 * marque (potentiellement surchargées par le thème admin). Hex uniquement :
 * les tokens de marque du backend sont des hex ; tout autre format retombe
 * sur le fallback fourni.
 *
 * Déplacé depuis `apps/mobile/src/theme/colorUtils.ts` — le web consomme
 * désormais les mêmes helpers pour construire son schéma clair.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse un hex #rgb ou #rrggbb. Retourne null si le format est inconnu. */
export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (long) {
    return {
      r: parseInt(long[1], 16),
      g: parseInt(long[2], 16),
      b: parseInt(long[3], 16),
    };
  }
  return null;
}

/**
 * `#8B5CF6` + 0.14 → `rgba(139, 92, 246, 0.14)`.
 * Si `color` n'est pas un hex parsable, retourne `fallback`.
 */
export function withAlpha(color: string, alpha: number, fallback: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Assombrit un hex d'un facteur 0-1 (0.2 = 20 % plus sombre).
 * Sert à dériver les états hover/pressed de la marque en thème clair.
 */
export function darken(color: string, factor: number, fallback: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) return fallback;
  const k = 1 - factor;
  const r = Math.round(rgb.r * k);
  const g = Math.round(rgb.g * k);
  const b = Math.round(rgb.b * k);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
