import type { PartialThemeTokens, ThemeTokens } from "../types";
import { CSS_VAR_NAMES, type CssEmittedTokens } from "./varNames";
import { REDUCED_MOTION_OVERRIDES } from "./reducedMotion";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const walk = (
  names: Record<string, unknown>,
  tokens: Record<string, unknown>,
  out: Array<[string, string]>,
): void => {
  for (const key of Object.keys(names)) {
    const nameNode = names[key];
    const tokenNode = tokens[key];
    if (typeof nameNode === "string" && typeof tokenNode === "string") {
      out.push([nameNode, tokenNode]);
    } else if (isObject(nameNode) && isObject(tokenNode)) {
      walk(nameNode, tokenNode, out);
    }
  }
};

/**
 * Flatten the emitted-subset of a theme into `[--name, value]` pairs in
 * declaration order (insertion order of `CSS_VAR_NAMES`). Pure helper —
 * useful when callers want to set properties via `element.style.setProperty`
 * instead of injecting a `<style>` block.
 */
export const themeToCssVarEntries = (
  tokens: ThemeTokens,
): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
  walk(
    CSS_VAR_NAMES as unknown as Record<string, unknown>,
    tokens as unknown as Record<string, unknown>,
    entries,
  );
  return entries;
};

/**
 * Flatten a deep-partial theme override into CSS variable entries. Unknown
 * keys and missing branches are skipped — only paths that exist both in the
 * `CSS_VAR_NAMES` map and the input override produce an entry. Safe to call
 * on arbitrary JSON from the backend.
 */
export const partialThemeToCssVarEntries = (
  override: PartialThemeTokens,
): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
  walk(
    CSS_VAR_NAMES as unknown as Record<string, unknown>,
    override as unknown as Record<string, unknown>,
    entries,
  );
  return entries;
};

export interface ToCssVariablesOptions {
  /** CSS selector to scope the variables to. Defaults to `:root`. */
  selector?: string;
  /** Whether to emit the `prefers-reduced-motion` override block. Default `true`. */
  includeReducedMotion?: boolean;
}

const formatBlock = (
  selector: string,
  entries: ReadonlyArray<readonly [string, string]>,
): string => {
  const lines = entries.map(([name, value]) => `  ${name}: ${value};`).join("\n");
  return `${selector} {\n${lines}\n}`;
};

/**
 * Emit the full CSS string for a theme: `:root` declarations + optional
 * reduced-motion overrides. Output is byte-for-byte equivalent in semantics
 * to the current static `apps/web/src/theme/tokens.css` (same names, same
 * order, same values).
 */
export const themeToCssVariables = (
  tokens: ThemeTokens,
  options: ToCssVariablesOptions = {},
): string => {
  const selector = options.selector ?? ":root";
  const includeReducedMotion = options.includeReducedMotion !== false;

  const entries = themeToCssVarEntries(tokens);
  const root = formatBlock(selector, entries);
  if (!includeReducedMotion) return root;

  const reducedBlock = formatBlock(selector, REDUCED_MOTION_OVERRIDES);
  return `${root}\n\n@media (prefers-reduced-motion: reduce) {\n${reducedBlock
    .split("\n")
    .map((l) => (l ? `  ${l}` : l))
    .join("\n")}\n}`;
};

export type { CssEmittedTokens };
