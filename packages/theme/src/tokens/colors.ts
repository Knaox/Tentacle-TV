import type { ColorTokens } from "../types";

/**
 * Default color tokens — verbatim from `apps/web/src/theme/tokens.css`.
 * Any change here must keep a 1:1 mapping with that file until the canonical
 * source is migrated in a later phase.
 */
export const DEFAULT_COLOR_TOKENS: ColorTokens = {
  surface: {
    s0: "#000000",
    s1: "#0a0a0a",
    s2: "#141414",
    s3: "#1f1f1f",
    overlay: "rgba(0, 0, 0, 0.7)",
    modal: "rgba(15, 15, 21, 0.96)",
    dropdown: "rgba(20, 20, 26, 0.95)",
    sheet: "rgba(15, 15, 21, 0.96)",
    toolbar: "rgba(20, 20, 26, 0.92)",
  },
  brand: {
    base: "#8B5CF6",
    rgb: "139, 92, 246",
    light: "#A78BFA",
    dark: "#7C3AED",
    soft: "rgba(139, 92, 246, 0.15)",
    glow: "rgba(139, 92, 246, 0.4)",
    accent: "#EC4899",
    accentRgb: "236, 72, 153",
    accentLight: "#F472B6",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255, 255, 255, 0.78)",
    tertiary: "rgba(255, 255, 255, 0.55)",
    quaternary: "rgba(255, 255, 255, 0.34)",
    disabled: "rgba(255, 255, 255, 0.22)",
  },
  cta: {
    primaryBg: "#FFFFFF",
    primaryBgHover: "rgba(255, 255, 255, 0.85)",
    primaryFg: "#000000",
    secondaryBg: "rgba(109, 109, 110, 0.55)",
    secondaryBgHover: "rgba(109, 109, 110, 0.78)",
    secondaryFg: "#FFFFFF",
    ghostBg: "rgba(255, 255, 255, 0.08)",
    ghostBgHover: "rgba(255, 255, 255, 0.14)",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.08)",
    strong: "rgba(255, 255, 255, 0.16)",
    focus: "rgba(139, 92, 246, 0.85)",
  },
  status: {
    success: {
      base: "#10b981",
      bg: "rgba(16, 185, 129, 0.15)",
      fg: "#34D399",
    },
    warning: {
      base: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.15)",
      fg: "#FBBF24",
    },
    error: {
      base: "#ef4444",
      bg: "rgba(239, 68, 68, 0.15)",
      fg: "#F87171",
    },
    info: {
      base: "#3b82f6",
      bg: "rgba(59, 130, 246, 0.15)",
      fg: "#60A5FA",
    },
  },
};
