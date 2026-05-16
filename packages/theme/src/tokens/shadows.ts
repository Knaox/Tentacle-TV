import type { ShadowTokens } from "../types";

/** Verbatim from `apps/web/src/theme/tokens.css` (--shadow-* and --elev-* groups). */
export const DEFAULT_SHADOW_TOKENS: ShadowTokens = {
  modal:
    "0 25px 70px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06)",
  dropdown:
    "0 12px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)",
  sheet: "0 -8px 32px rgba(0, 0, 0, 0.5)",
  elev1: "0 4px 12px rgba(0, 0, 0, 0.4)",
  elev2: "0 8px 24px rgba(0, 0, 0, 0.55)",
  elev3: "0 16px 48px rgba(0, 0, 0, 0.7)",
  cardHover:
    "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)",
};
