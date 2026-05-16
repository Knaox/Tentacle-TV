import {
  partialThemeToCssVarEntries,
  type PartialThemeTokens,
} from "@tentacle-tv/theme";

/**
 * Apply a partial token override to the document root. Writes each entry as an
 * inline custom property on `<html>` — which beats the static `tokens.css`
 * stylesheet in cascade specificity. Returns the list of property names that
 * were set so the caller can clear them later when the override is removed.
 */
export function applyTokenOverride(override: PartialThemeTokens): string[] {
  const entries = partialThemeToCssVarEntries(override);
  const root = document.documentElement;
  for (const [name, value] of entries) {
    root.style.setProperty(name, value);
  }
  return entries.map(([name]) => name);
}

export function clearTokenOverride(propertyNames: ReadonlyArray<string>): void {
  const root = document.documentElement;
  for (const name of propertyNames) {
    root.style.removeProperty(name);
  }
}
