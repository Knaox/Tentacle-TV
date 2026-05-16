import type { PartialThemeTokens } from "@tentacle-tv/theme";

/**
 * Read the current value of a token at a dot-path, falling back to the
 * default when the path is not yet overridden.
 */
export function getTokenValue(
  override: PartialThemeTokens | undefined,
  defaultValue: string,
  path: string,
): string {
  if (!override) return defaultValue;
  const parts = path.split(".");
  let cursor: unknown = override;
  for (const key of parts) {
    if (cursor && typeof cursor === "object" && key in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[key];
    } else {
      return defaultValue;
    }
  }
  return typeof cursor === "string" ? cursor : defaultValue;
}

/**
 * Build a nested partial object from a dot-path and a leaf value.
 *   buildTokenPatch("color.brand.base", "#FF0000")
 *   → { color: { brand: { base: "#FF0000" } } }
 */
export function buildTokenPatch(path: string, value: string): PartialThemeTokens {
  const parts = path.split(".");
  const root: Record<string, unknown> = {};
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next: Record<string, unknown> = {};
    cursor[parts[i]] = next;
    cursor = next;
  }
  cursor[parts[parts.length - 1]] = value;
  return root as unknown as PartialThemeTokens;
}
