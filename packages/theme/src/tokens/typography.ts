import type { TypographyTokens } from "../types";

/**
 * Typography tokens — font family + size scale. fontSize values match
 * `apps/web/tailwind.config.ts` (display-1..3, heading-1..3) and the shared
 * mobile/TV scale (body, caption, small, badge). Weights and line-heights are
 * applied by consumers (Tailwind class definitions, RN text style helpers).
 */
export const DEFAULT_TYPOGRAPHY_TOKENS: TypographyTokens = {
  fontFamily: {
    sans: '"Inter", system-ui, -apple-system, sans-serif',
  },
  fontSize: {
    display1: "4.5rem",
    display2: "3rem",
    display3: "2rem",
    heading1: "1.5rem",
    heading2: "1.25rem",
    heading3: "1.125rem",
    body: "15px",
    bodyLg: "16px",
    caption: "13px",
    small: "11px",
    badge: "10px",
  },
};
