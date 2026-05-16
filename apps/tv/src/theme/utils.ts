/**
 * Token-string → numeric helpers for React Native (TV). Tokens in
 * `@tentacle-tv/theme` are CSS strings (`"16px"`, `"240ms"`, `"1.5"`); RN
 * styles require unitless numbers.
 */

export function parsePx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseMs(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseScale(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 1;
}
