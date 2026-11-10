import type { ColorTokens } from "../types";

/**
 * ⚠️ Depuis la refonte du web (nov. 2026), ces valeurs ne sont PLUS la copie de
 * `apps/web/src/theme/tokens.css` : le web et le bureau ont leur peau dans cette feuille, et ce
 * que voici reste ce que l'Apple TV et Android TV lisent (`native/tvTokens.ts`) — elles n'ont pas
 * été redessinées. Seuls les NOMS sont tenus en miroir (`cssVars.test.ts`) ; les clés ajoutées par
 * la refonte portent, elles, les valeurs du web.
 */
export const DEFAULT_COLOR_TOKENS: ColorTokens = {
  surface: {
    s0: "#000000",
    s1: "#0a0a0a",
    s2: "#141414",
    s3: "#1f1f1f",
    s4: "#303036",
    overlay: "rgba(0, 0, 0, 0.7)",
    modal: "rgba(15, 15, 21, 0.96)",
    dropdown: "rgba(20, 20, 26, 0.95)",
    sheet: "rgba(15, 15, 21, 0.96)",
    toolbar: "rgba(20, 20, 26, 0.92)",
    s0Tint: "#070710",
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
    accentDark: "#DB2777",
  },
  accent: {
    base: "#E58CF0",
    rgb: "229, 140, 240",
    soft: "rgba(229, 140, 240, 0.16)",
    on: "#27062E",
  },
  gauge: {
    track: "rgba(255, 255, 255, 0.18)",
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
    // Pilule blanche pleine en sombre : aucun liseré, mais le token est émis
    // pour que le composant applique un `border` inconditionnel.
    primaryBorder: "transparent",
    brandFg: "#FFFFFF",
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
  fill: {
    faint: "rgba(255, 255, 255, 0.03)",
    subtle: "rgba(255, 255, 255, 0.05)",
    soft: "rgba(255, 255, 255, 0.08)",
    medium: "rgba(255, 255, 255, 0.12)",
    strong: "rgba(255, 255, 255, 0.28)",
    shimmer: "rgba(255, 255, 255, 0.05)",
  },
  glass: {
    tint: "rgba(20, 20, 26, 0.6)",
    tintStrong: "rgba(10, 10, 18, 0.72)",
    panel: "#0a0a0a",
    backdrop: "rgba(0, 0, 0, 0.55)",
  },
  onMedia: {
    primary: "#FFFFFF",
    secondary: "rgba(255, 255, 255, 0.80)",
    shadow: "rgba(0, 0, 0, 0.7)",
    scrimRgb: "0, 0, 0",
    muted: "rgba(255, 255, 255, 0.30)",
  },
  danger: {
    surface: "rgba(239, 68, 68, 0.1)",
    surfaceHover: "rgba(239, 68, 68, 0.22)",
    border: "rgba(239, 68, 68, 0.2)",
  },
};
