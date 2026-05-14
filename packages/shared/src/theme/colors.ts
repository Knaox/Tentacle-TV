/**
 * Shared brand color tokens — single source of truth across web, TV and mobile.
 *
 * Pure module: no DOM, no React Native, no platform imports.
 * Each platform consumes these and maps them to its own theme system
 * (CSS variables on web, StyleSheet constants on RN).
 */

// ─── Brand (Tentacle violet) ────────────────────────────────────────────────
export const BRAND = {
  violet: "#8B5CF6",
  light: "#A78BFA",
  dark: "#7C3AED",
  /** Soft 35% violet — used for focus glow and ambient backdrop tint. */
  glow: "rgba(139, 92, 246, 0.35)",
  /** 15% violet — used for subtle backgrounds (active row, badges). */
  soft: "rgba(139, 92, 246, 0.15)",
  /** 18% violet — used for ghost button backgrounds. */
  ghost: "rgba(139, 92, 246, 0.18)",
} as const;

// ─── Surface tiers (cinematic black) ────────────────────────────────────────
export const SURFACE = {
  /** Page background. */
  s0: "#000000",
  /** Card / panel default. */
  s1: "#0a0a0a",
  /** Hover / modal panel. */
  s2: "#141414",
  /** Elevated chrome (dropdowns, sheets). */
  s3: "#1f1f1f",
  /** Modal scrim. */
  overlay: "rgba(0, 0, 0, 0.7)",
} as const;

// ─── Text hierarchy (white-on-dark) ─────────────────────────────────────────
export const TEXT = {
  primary: "#FFFFFF",
  secondary: "rgba(255, 255, 255, 0.78)",
  tertiary: "rgba(255, 255, 255, 0.55)",
  quaternary: "rgba(255, 255, 255, 0.34)",
  disabled: "rgba(255, 255, 255, 0.22)",
} as const;

// ─── Status colors ──────────────────────────────────────────────────────────
export const STATUS = {
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  rating: "#fbbf24",
} as const;

/** Background+foreground pairs for status badges/toasts (matches web tokens.css). */
export const STATUS_PAIRS = {
  success: { bg: "rgba(16, 185, 129, 0.15)", fg: "#34D399" },
  warning: { bg: "rgba(245, 158, 11, 0.15)", fg: "#FBBF24" },
  error: { bg: "rgba(239, 68, 68, 0.15)", fg: "#F87171" },
  info: { bg: "rgba(59, 130, 246, 0.15)", fg: "#60A5FA" },
} as const;

// ─── Borders ────────────────────────────────────────────────────────────────
export const BORDER = {
  subtle: "rgba(255, 255, 255, 0.08)",
  strong: "rgba(255, 255, 255, 0.16)",
  /** TV / keyboard focus ring. */
  focus: BRAND.violet,
} as const;

// ─── Netflix-style CTA palette ──────────────────────────────────────────────
/**
 * Primary = white pill (Lecture).
 * Secondary = grey translucent (Plus d'infos).
 * Ghost = subtle white tint (icônes action).
 * Brand = violet (réservé aux accents Tentacle, rare).
 */
export const CTA = {
  primaryBg: "#FFFFFF",
  primaryBgHover: "rgba(255, 255, 255, 0.85)",
  primaryFg: "#000000",
  secondaryBg: "rgba(109, 109, 110, 0.55)",
  secondaryBgHover: "rgba(109, 109, 110, 0.78)",
  secondaryFg: "#FFFFFF",
  ghostBg: "rgba(255, 255, 255, 0.08)",
  ghostBgHover: "rgba(255, 255, 255, 0.14)",
  ghostFg: "#FFFFFF",
  brandBg: BRAND.violet,
  brandBgHover: BRAND.dark,
  brandFg: "#FFFFFF",
} as const;

// ─── Overlay / scrim ────────────────────────────────────────────────────────
export const OVERLAY = {
  scrim: "rgba(0, 0, 0, 0.7)",
  scrimSoft: "rgba(0, 0, 0, 0.4)",
  scrimHeavy: "rgba(0, 0, 0, 0.85)",
} as const;

// ─── Type aliases ───────────────────────────────────────────────────────────
export type BrandColor = keyof typeof BRAND;
export type SurfaceTier = keyof typeof SURFACE;
export type TextTier = keyof typeof TEXT;
export type StatusKind = keyof typeof STATUS;
export type CtaTier = keyof typeof CTA;
export type OverlayTier = keyof typeof OVERLAY;
