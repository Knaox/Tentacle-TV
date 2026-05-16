import type { SpacingTokens } from "../types";

/**
 * 4-pt spacing scale. Not currently emitted as CSS variables (Tailwind's
 * default scale is consumed by the web app — emitting --spacing-* would
 * shadow it without value). Used by the mobile/TV `useTheme` hook.
 */
export const DEFAULT_SPACING_TOKENS: SpacingTokens = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "32px",
  "4xl": "40px",
  "5xl": "48px",
  "6xl": "64px",
};
