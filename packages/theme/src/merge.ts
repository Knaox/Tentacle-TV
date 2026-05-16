import type { PartialThemeTokens, Theme, ThemeTokens } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep-merge `override` onto `base`. Only string leaves and nested plain
 * objects are walked — arrays would not be valid token shapes so we treat
 * them as scalars. Pure function, never mutates inputs.
 */
const mergeRecord = <T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown> | undefined,
): T => {
  if (!override) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const baseValue = base[key];
    const overrideValue = override[key];
    if (overrideValue === undefined) continue;
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      out[key] = mergeRecord(baseValue, overrideValue);
    } else {
      out[key] = overrideValue;
    }
  }
  return out as T;
};

export const mergeThemeTokens = (
  base: ThemeTokens,
  override: PartialThemeTokens | undefined,
): ThemeTokens =>
  mergeRecord(
    base as unknown as Record<string, unknown>,
    override as Record<string, unknown> | undefined,
  ) as unknown as ThemeTokens;

export const mergeTheme = (
  base: Theme,
  override: { id?: string; name?: string; tokens?: PartialThemeTokens } | undefined,
): Theme => {
  if (!override) return base;
  return {
    id: override.id ?? base.id,
    name: override.name ?? base.name,
    tokens: mergeThemeTokens(base.tokens, override.tokens),
  };
};
