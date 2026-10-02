/**
 * Les couleurs de marque partagées — la source unique du web, de la TV et du
 * mobile.
 *
 * Module pur : ni DOM, ni React Native, aucun import de plateforme.
 *
 * Rien ne réécrit plus ces objets à l'exécution : la surcharge de
 * l'administrateur (`/api/theme`), et avec elle les presets saisonniers, a
 * quitté le serveur (1.17) puis les clients. Les palettes et les écrans les
 * lisent tels quels.
 */

// ─── Defaults (immutable reference values) ──────────────────────────────────
const DEFAULT_BRAND = {
  violet: "#8B5CF6",
  light: "#A78BFA",
  dark: "#7C3AED",
  /** Soft 35% violet — used for focus glow and ambient backdrop tint. */
  glow: "rgba(139, 92, 246, 0.35)",
  /** 15% violet — used for subtle backgrounds (active row, badges). */
  soft: "rgba(139, 92, 246, 0.15)",
  /** 18% violet — used for ghost button backgrounds. */
  ghost: "rgba(139, 92, 246, 0.18)",
  // Le ROSE d'accent — second arrêt des dégradés de marque (violet → rose),
  // mêmes valeurs que le web (`--brand-accent*` de tokens.css). Trio miroir
  // de violet/light/dark : `accentDark` sert d'accent au thème clair.
  accent: "#EC4899",
  accentLight: "#F472B6",
  accentDark: "#DB2777",
};

const DEFAULT_SURFACE = {
  s0: "#000000",
  s1: "#0a0a0a",
  s2: "#141414",
  s3: "#1f1f1f",
  overlay: "rgba(0, 0, 0, 0.7)",
};

const DEFAULT_TEXT = {
  primary: "#FFFFFF",
  secondary: "rgba(255, 255, 255, 0.78)",
  tertiary: "rgba(255, 255, 255, 0.55)",
  quaternary: "rgba(255, 255, 255, 0.34)",
  disabled: "rgba(255, 255, 255, 0.22)",
};

const DEFAULT_STATUS = {
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  rating: "#fbbf24",
};

const DEFAULT_STATUS_PAIRS = {
  success: { bg: "rgba(16, 185, 129, 0.15)", fg: "#34D399" },
  warning: { bg: "rgba(245, 158, 11, 0.15)", fg: "#FBBF24" },
  error: { bg: "rgba(239, 68, 68, 0.15)", fg: "#F87171" },
  info: { bg: "rgba(59, 130, 246, 0.15)", fg: "#60A5FA" },
};

const DEFAULT_BORDER = {
  subtle: "rgba(255, 255, 255, 0.08)",
  strong: "rgba(255, 255, 255, 0.16)",
  focus: DEFAULT_BRAND.violet,
};

const DEFAULT_CTA = {
  primaryBg: "#FFFFFF",
  primaryBgHover: "rgba(255, 255, 255, 0.85)",
  primaryFg: "#000000",
  secondaryBg: "rgba(109, 109, 110, 0.55)",
  secondaryBgHover: "rgba(109, 109, 110, 0.78)",
  secondaryFg: "#FFFFFF",
  ghostBg: "rgba(255, 255, 255, 0.08)",
  ghostBgHover: "rgba(255, 255, 255, 0.14)",
  ghostFg: "#FFFFFF",
  brandBg: DEFAULT_BRAND.violet,
  brandBgHover: DEFAULT_BRAND.dark,
  brandFg: "#FFFFFF",
};

const DEFAULT_OVERLAY = {
  scrim: "rgba(0, 0, 0, 0.7)",
  scrimSoft: "rgba(0, 0, 0, 0.4)",
  scrimHeavy: "rgba(0, 0, 0, 0.85)",
};

// ─── Les exports : les valeurs de référence ────────────────────────────────
export const BRAND: { -readonly [K in keyof typeof DEFAULT_BRAND]: string } = { ...DEFAULT_BRAND };
export const SURFACE: { -readonly [K in keyof typeof DEFAULT_SURFACE]: string } = { ...DEFAULT_SURFACE };
export const TEXT: { -readonly [K in keyof typeof DEFAULT_TEXT]: string } = { ...DEFAULT_TEXT };
export const STATUS: { -readonly [K in keyof typeof DEFAULT_STATUS]: string } = { ...DEFAULT_STATUS };
export const STATUS_PAIRS = {
  success: { ...DEFAULT_STATUS_PAIRS.success },
  warning: { ...DEFAULT_STATUS_PAIRS.warning },
  error: { ...DEFAULT_STATUS_PAIRS.error },
  info: { ...DEFAULT_STATUS_PAIRS.info },
};
export const BORDER: { -readonly [K in keyof typeof DEFAULT_BORDER]: string } = { ...DEFAULT_BORDER };
export const CTA: { -readonly [K in keyof typeof DEFAULT_CTA]: string } = { ...DEFAULT_CTA };
export const OVERLAY: { -readonly [K in keyof typeof DEFAULT_OVERLAY]: string } = { ...DEFAULT_OVERLAY };

// ─── Type aliases (back-compat) ─────────────────────────────────────────────
export type BrandColor = keyof typeof BRAND;
export type SurfaceTier = keyof typeof SURFACE;
export type TextTier = keyof typeof TEXT;
export type StatusKind = keyof typeof STATUS;
export type CtaTier = keyof typeof CTA;
export type OverlayTier = keyof typeof OVERLAY;
