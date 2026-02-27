/** Tentacle TV — Premium Cinematic Design System */

// ─── Color Palette ───────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  bgDeep: "#06060a",
  bgSurface: "#0f0f18",
  bgElevated: "#1a1a2e",
  bgCard: "#12121a",

  // Accents
  accentPurple: "#8b5cf6",
  accentPurpleLight: "#a78bfa",
  accentPink: "#ec4899",

  // Text
  textPrimary: "#ffffff",
  textSecondary: "#e4e4e7",
  textTertiary: "#71717a",
  textMuted: "rgba(255,255,255,0.5)",

  // Status
  success: "#22c55e",
  progressOrange: "#f59e0b",
  error: "#ef4444",
  ratingGold: "#fbbf24",

  // Glassmorphism
  glassBg: "rgba(15, 15, 24, 0.75)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  glassBgHeavy: "rgba(15, 15, 24, 0.85)",

  // Overlays
  overlayDim: "rgba(0, 0, 0, 0.20)",
  overlayHeavy: "rgba(0, 0, 0, 0.60)",
  overlayGradientStart: "transparent",
  overlayGradientEnd: "#06060a",

  // Focus
  focusGlow: "rgba(139, 92, 246, 0.3)",
  focusBorder: "#8b5cf6",

  // Dividers
  divider: "rgba(255, 255, 255, 0.06)",
  border: "#1e1e2e",
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const Spacing = {
  /** Padding from screen edges */
  screenPadding: 32,
  /** Gap between content sections/rows */
  sectionGap: 28,
  /** Gap between cards in a carousel */
  cardGap: 12,
  /** Gap between buttons */
  buttonGap: 10,
  /** Space between synopsis and buttons */
  synopsisToButtons: 16,
  /** Space between hero title and metadata */
  titleToMeta: 6,
  /** Space between metadata and synopsis */
  metaToSynopsis: 10,
  /** Internal padding of glassmorphism panels */
  glassPadding: 16,
  /** Sidebar width when open */
  sidebarWidth: 220,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const Typography = {
  heroTitle: { fontSize: 32, fontWeight: "800" as const },
  sectionTitle: { fontSize: 18, fontWeight: "600" as const },
  pageTitle: { fontSize: 22, fontWeight: "800" as const },
  detailTitle: { fontSize: 28, fontWeight: "800" as const },
  cardTitle: { fontSize: 13, fontWeight: "500" as const },
  meta: { fontSize: 12, fontWeight: "400" as const },
  synopsis: { fontSize: 13, fontWeight: "400" as const },
  buttonLarge: { fontSize: 14, fontWeight: "700" as const },
  buttonMedium: { fontSize: 13, fontWeight: "600" as const },
  body: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 11, fontWeight: "400" as const },
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
  /** Percentage of screen height for hero */
  heightRatio: 0.55,
  /** Auto-rotate interval in ms */
  rotateInterval: 10_000,
  /** Crossfade duration in ms */
  crossfadeDuration: 800,
  /** Ken Burns zoom target */
  kenBurnsScale: 1.05,
  /** Ken Burns duration in ms */
  kenBurnsDuration: 15_000,
} as const;

// ─── Focus Animation ─────────────────────────────────────────────────────────

export const FocusConfig = {
  scaleUp: 1.05,
  scaleNormal: 1.0,
  borderWidth: 2,
  glowRadius: 20,
  springDamping: 15,
  springStiffness: 150,
} as const;

// ─── Card Dimensions ─────────────────────────────────────────────────────────

export const CardConfig = {
  portrait: {
    width: 130,
    aspectRatio: 2 / 3,
  },
  landscape: {
    width: 220,
    aspectRatio: 16 / 9,
  },
  progressBarHeight: 3,
} as const;
