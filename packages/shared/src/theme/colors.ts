/**
 * Shared brand color tokens — single source of truth across web, TV and mobile.
 *
 * Pure module: no DOM, no React Native, no platform imports.
 *
 * RUNTIME MUTATION: the exported objects (BRAND, SURFACE, …) are intentionally
 * mutable so that mobile/TV can apply an admin theme override at boot via
 * `applyThemeOverride()` — every consumer reading `BRAND.violet`,
 * `SURFACE.s0`, etc. inline will see the override without code change.
 *
 * Caveat: properties captured at module-evaluation time (e.g. inside a
 * `StyleSheet.create({ … })` declared at the top of a file) are snapshotted
 * and won't reflect later overrides. Inline-style consumers (the bulk of
 * the codebase) benefit automatically.
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

// ─── Live exports — start with defaults, mutated by `applyThemeOverride` ────
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

// ─── Runtime override API ───────────────────────────────────────────────────

/** Subset of `PartialThemeTokens` (kept loose to avoid cross-package coupling). */
export interface ThemeColorOverride {
  color?: {
    brand?: {
      base?: string;
      light?: string;
      dark?: string;
      soft?: string;
      ghost?: string;
      glow?: string;
    };
    surface?: {
      s0?: string;
      s1?: string;
      s2?: string;
      s3?: string;
      overlay?: string;
    };
    text?: {
      primary?: string;
      secondary?: string;
      tertiary?: string;
      quaternary?: string;
      disabled?: string;
    };
    status?: {
      success?: { base?: string; bg?: string; fg?: string };
      warning?: { base?: string; bg?: string; fg?: string };
      error?: { base?: string; bg?: string; fg?: string };
      info?: { base?: string; bg?: string; fg?: string };
    };
    cta?: {
      primaryBg?: string;
      primaryBgHover?: string;
      primaryFg?: string;
      secondaryBg?: string;
      secondaryBgHover?: string;
      secondaryFg?: string;
      ghostBg?: string;
      ghostBgHover?: string;
    };
    border?: {
      subtle?: string;
      strong?: string;
      focus?: string;
    };
  };
}

/**
 * Apply a partial theme override on top of the canonical defaults. Mutates
 * the exported objects in place so any consumer reading `BRAND.violet`,
 * `SURFACE.s0`, etc. at render time gets the new value.
 *
 * Pass `null` (or omit) to reset to defaults.
 */
export function applyThemeOverride(override?: ThemeColorOverride | null): void {
  // Reset to defaults first — guarantees a clean slate.
  Object.assign(BRAND, DEFAULT_BRAND);
  Object.assign(SURFACE, DEFAULT_SURFACE);
  Object.assign(TEXT, DEFAULT_TEXT);
  Object.assign(STATUS, DEFAULT_STATUS);
  Object.assign(STATUS_PAIRS.success, DEFAULT_STATUS_PAIRS.success);
  Object.assign(STATUS_PAIRS.warning, DEFAULT_STATUS_PAIRS.warning);
  Object.assign(STATUS_PAIRS.error, DEFAULT_STATUS_PAIRS.error);
  Object.assign(STATUS_PAIRS.info, DEFAULT_STATUS_PAIRS.info);
  Object.assign(BORDER, DEFAULT_BORDER);
  Object.assign(CTA, DEFAULT_CTA);
  Object.assign(OVERLAY, DEFAULT_OVERLAY);

  if (!override?.color) return;
  const c = override.color;

  if (c.brand) {
    if (c.brand.base) BRAND.violet = c.brand.base;
    if (c.brand.light) BRAND.light = c.brand.light;
    if (c.brand.dark) BRAND.dark = c.brand.dark;
    if (c.brand.soft) BRAND.soft = c.brand.soft;
    if (c.brand.ghost) BRAND.ghost = c.brand.ghost;
    if (c.brand.glow) BRAND.glow = c.brand.glow;
    // BORDER.focus + CTA.brandBg/Hover derive from BRAND — sync them too.
    BORDER.focus = BRAND.violet;
    CTA.brandBg = BRAND.violet;
    CTA.brandBgHover = BRAND.dark;
  }
  if (c.surface) {
    if (c.surface.s0) SURFACE.s0 = c.surface.s0;
    if (c.surface.s1) SURFACE.s1 = c.surface.s1;
    if (c.surface.s2) SURFACE.s2 = c.surface.s2;
    if (c.surface.s3) SURFACE.s3 = c.surface.s3;
    if (c.surface.overlay) {
      SURFACE.overlay = c.surface.overlay;
      OVERLAY.scrim = c.surface.overlay;
    }
  }
  if (c.text) {
    if (c.text.primary) TEXT.primary = c.text.primary;
    if (c.text.secondary) TEXT.secondary = c.text.secondary;
    if (c.text.tertiary) TEXT.tertiary = c.text.tertiary;
    if (c.text.quaternary) TEXT.quaternary = c.text.quaternary;
    if (c.text.disabled) TEXT.disabled = c.text.disabled;
  }
  if (c.status) {
    if (c.status.success?.base) STATUS.success = c.status.success.base;
    if (c.status.success?.bg) STATUS_PAIRS.success.bg = c.status.success.bg;
    if (c.status.success?.fg) STATUS_PAIRS.success.fg = c.status.success.fg;
    if (c.status.warning?.base) STATUS.warning = c.status.warning.base;
    if (c.status.warning?.bg) STATUS_PAIRS.warning.bg = c.status.warning.bg;
    if (c.status.warning?.fg) STATUS_PAIRS.warning.fg = c.status.warning.fg;
    if (c.status.error?.base) STATUS.error = c.status.error.base;
    if (c.status.error?.bg) STATUS_PAIRS.error.bg = c.status.error.bg;
    if (c.status.error?.fg) STATUS_PAIRS.error.fg = c.status.error.fg;
    if (c.status.info?.base) STATUS.info = c.status.info.base;
    if (c.status.info?.bg) STATUS_PAIRS.info.bg = c.status.info.bg;
    if (c.status.info?.fg) STATUS_PAIRS.info.fg = c.status.info.fg;
  }
  if (c.cta) {
    if (c.cta.primaryBg) CTA.primaryBg = c.cta.primaryBg;
    if (c.cta.primaryBgHover) CTA.primaryBgHover = c.cta.primaryBgHover;
    if (c.cta.primaryFg) CTA.primaryFg = c.cta.primaryFg;
    if (c.cta.secondaryBg) CTA.secondaryBg = c.cta.secondaryBg;
    if (c.cta.secondaryBgHover) CTA.secondaryBgHover = c.cta.secondaryBgHover;
    if (c.cta.secondaryFg) CTA.secondaryFg = c.cta.secondaryFg;
    if (c.cta.ghostBg) CTA.ghostBg = c.cta.ghostBg;
    if (c.cta.ghostBgHover) CTA.ghostBgHover = c.cta.ghostBgHover;
  }
  if (c.border) {
    if (c.border.subtle) BORDER.subtle = c.border.subtle;
    if (c.border.strong) BORDER.strong = c.border.strong;
    if (c.border.focus) BORDER.focus = c.border.focus;
  }
}
