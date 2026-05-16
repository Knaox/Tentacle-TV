/**
 * Token-string → numeric helpers for React Native. Tokens in `@tentacle-tv/theme`
 * are CSS-friendly strings (`"16px"`, `"240ms"`, `"1.5"`). RN style props are
 * unitless numbers — these helpers bridge the gap.
 */

/** Strip a trailing `px` suffix and parse to number. Returns 0 if invalid. */
export function parsePx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Strip a trailing `ms` suffix and parse to number (milliseconds). */
export function parseMs(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a scalar (e.g. `hover-scale` = "1.5"). Returns 1 if invalid. */
export function parseScale(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 1;
}
