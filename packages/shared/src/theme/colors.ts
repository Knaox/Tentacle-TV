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

// ─── Borders ────────────────────────────────────────────────────────────────
export const BORDER = {
  subtle: "rgba(255, 255, 255, 0.08)",
  strong: "rgba(255, 255, 255, 0.16)",
  /** TV / keyboard focus ring. */
  focus: BRAND.violet,
} as const;

// ─── Type aliases ───────────────────────────────────────────────────────────
export type BrandColor = keyof typeof BRAND;
export type SurfaceTier = keyof typeof SURFACE;
export type TextTier = keyof typeof TEXT;
