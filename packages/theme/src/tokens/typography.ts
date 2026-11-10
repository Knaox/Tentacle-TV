import type { TypographyTokens } from "../types";

/**
 * Typography tokens — font family + size scale. fontSize values match
 * `apps/web/tailwind.config.ts` (display-1..3, heading-1..3) and the shared
 * mobile/TV scale (body, caption, small, badge). Weights and line-heights are
 * applied by consumers (Tailwind class definitions, RN text style helpers).
 */
export const DEFAULT_TYPOGRAPHY_TOKENS: TypographyTokens = {
  fontFamily: {
    // Le TEXTE : Figtree (refonte de nov. 2026), embarquée par `apps/web/src/theme/fonts.css`.
    // « Inter Variable » reste derrière : embarquée elle aussi, elle porte le cyrillique et le grec
    // que Figtree n'a pas (les titres d'une bibliothèque en sont pleins) ; « Inter » pour qui
    // l'a installée. Même pile que `--font-text` de tokens.css.
    sans: '"Figtree Variable", "Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    // Les TITRES : Bricolage Grotesque, puis la pile du texte. Même pile que `--font-display`.
    display: '"Bricolage Grotesque Variable", "Figtree Variable", "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif',
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
