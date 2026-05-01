/** Tentacle TV — Premium Cinematic Design System */

import { BRAND, SURFACE, TEXT, STATUS, BORDER } from "@tentacle-tv/shared";

// ─── Color Palette ───────────────────────────────────────────────────────────
// Brand + surface + text now come from packages/shared so web/TV/mobile
// share a single source of truth. TV-specific tokens (focus, glassmorphism,
// progress orange) stay local because they don't apply to other platforms.

export const Colors = {
  // Backgrounds — TV uses a slightly warmer #06060a for OLED legibility.
  // Falls back to surface tokens for everything else.
  bgDeep: "#06060a",
  bgSurface: SURFACE.s1,
  bgElevated: SURFACE.s3,
  bgCard: "#12121a",

  // Accents (shared)
  accentPurple: BRAND.violet,
  accentPurpleLight: BRAND.light,
  accentPink: "#ec4899",

  // Text (shared)
  textPrimary: TEXT.primary,
  textSecondary: TEXT.secondary,
  textTertiary: TEXT.tertiary,
  textMuted: TEXT.quaternary,

  // Status (shared)
  success: STATUS.success,
  progressOrange: STATUS.warning,
  error: STATUS.error,
  ratingGold: STATUS.rating,

  // Glassmorphism (TV-specific — not used on web)
  glassBg: "rgba(15, 15, 24, 0.75)",
  glassBorder: BORDER.subtle,
  glassBgHeavy: "rgba(15, 15, 24, 0.85)",

  // Overlays
  overlayDim: "rgba(0, 0, 0, 0.20)",
  overlayHeavy: "rgba(0, 0, 0, 0.60)",
  overlayGradientStart: "transparent",
  overlayGradientEnd: "#06060a",

  // Focus (shared brand glow)
  focusGlow: BRAND.glow,
  focusBorder: BRAND.violet,

  // Dividers
  divider: "rgba(255, 255, 255, 0.06)",
  border: "#1e1e2e",
} as const;

// Re-export shared tokens for convenience inside TV components.
export { BRAND, SURFACE, TEXT, STATUS, BORDER };

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const Spacing = {
  /** Padding from screen edges (TV overscan-safe). */
  screenPadding: 32,
  /** Gap between content sections/rows. */
  sectionGap: 28,
  /** Gap between cards in a carousel. */
  cardGap: 16,
  /** Gap between buttons. */
  buttonGap: 10,
  /** Space between synopsis and buttons. */
  synopsisToButtons: 16,
  /** Space between hero title and metadata. */
  titleToMeta: 6,
  /** Space between metadata and synopsis. */
  metaToSynopsis: 10,
  /** Internal padding of glassmorphism panels. */
  glassPadding: 16,
  /** Sidebar width when open. */
  sidebarWidth: 220,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const Typography = {
  heroTitle: { fontSize: 32, fontWeight: "800" as const },
  sectionTitle: { fontSize: 20, fontWeight: "600" as const },
  pageTitle: { fontSize: 22, fontWeight: "800" as const },
  detailTitle: { fontSize: 28, fontWeight: "800" as const },
  cardTitle: { fontSize: 16, fontWeight: "500" as const },
  meta: { fontSize: 16, fontWeight: "400" as const },
  synopsis: { fontSize: 16, fontWeight: "400" as const },
  buttonLarge: { fontSize: 16, fontWeight: "700" as const },
  buttonMedium: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  caption: { fontSize: 14, fontWeight: "400" as const },
  /** Tagline above hero title — italic, dimmed. */
  tagline: { fontSize: 15, fontWeight: "400" as const, fontStyle: "italic" as const },
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const Radius = {
  card: 8,
  button: 8,
  buttonLarge: 10,
  pill: 14,
  modal: 12,
  small: 6,
  full: 9999,
} as const;

// ─── Hero Banner ─────────────────────────────────────────────────────────────

export const HeroConfig = {
  /** Percentage of screen height for hero — bumped to 0.65 for cinematic feel. */
  heightRatio: 0.65,
  /** Auto-rotate interval in ms. */
  rotateInterval: 10_000,
  /** Crossfade duration in ms. */
  crossfadeDuration: 800,
  /** Ken Burns zoom target. */
  kenBurnsScale: 1.05,
  /** Ken Burns duration in ms. */
  kenBurnsDuration: 15_000,
} as const;

// ─── Focus Animation (legacy — see ./focus.ts for full token set) ───────────

export const FocusConfig = {
  scaleUp: 1.05,
  scaleNormal: 1.0,
  borderWidth: 0,
  glowRadius: 20,
  springDamping: 18,
  springStiffness: 200,
  shadowColor: BRAND.violet,
  shadowOpacity: 0.5,
  shadowRadius: 12,
  elevation: 8,
} as const;

// ─── Card Dimensions ─────────────────────────────────────────────────────────

export const CardConfig = {
  portrait: {
    width: 180,           // bumped from 160 for better readability at 3m
    aspectRatio: 2 / 3,
  },
  landscape: {
    width: 320,           // bumped from 260 for Continue Watching emphasis
    aspectRatio: 16 / 9,
  },
  progressBarHeight: 3,
} as const;

// ─── Ambient Backdrop ────────────────────────────────────────────────────────

export const AmbientConfig = {
  /** Crossfade duration when focused item changes. */
  crossfadeDuration: 800,
  /** Image opacity over the page background. */
  imageOpacity: 0.32,
  /** Subtle vertical scrim to keep content legible. */
  scrimOpacity: 0.55,
} as const;
