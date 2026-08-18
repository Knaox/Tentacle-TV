/** Tentacle TV — Premium Cinematic Design System */

import { BRAND, SURFACE, TEXT, STATUS, BORDER } from "@tentacle-tv/shared";
import { TV_BANNER_CARD, withAlpha } from "@tentacle-tv/theme";

// ─── Color Palette ───────────────────────────────────────────────────────────
// Brand + surface + text now come from packages/shared so web/TV/mobile
// share a single source of truth. TV-specific tokens (focus, glassmorphism,
// progress orange) stay local because they don't apply to other platforms.

/**
 * TV colour namespace — getters bind every shared-token-derived field to the
 * live `BRAND` / `SURFACE` / `TEXT` / `STATUS` / `BORDER` exports from
 * `@tentacle-tv/shared`. After `applyThemeOverride()` runs at boot
 * (post `/api/theme` fetch), inline-style consumers reading `Colors.accentPurple`
 * etc. immediately reflect the admin's override. TV-specific values
 * (`bgDeep` OLED black, `bgCard`, glass tints) stay hardcoded by design.
 */
interface TvColors {
  readonly bgDeep: string;
  readonly bgSurface: string;
  readonly bgElevated: string;
  readonly bgCard: string;
  readonly accentPurple: string;
  readonly accentPurpleLight: string;
  readonly accentPink: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly textMuted: string;
  readonly success: string;
  readonly progressOrange: string;
  readonly error: string;
  readonly ratingGold: string;
  readonly glassBg: string;
  readonly glassBorder: string;
  readonly glassBgHeavy: string;
  readonly overlayDim: string;
  readonly overlayHeavy: string;
  readonly overlayGradientStart: string;
  readonly overlayGradientEnd: string;
  readonly focusGlow: string;
  readonly focusBorder: string;
  readonly divider: string;
  readonly border: string;
  readonly ctaPrimaryBg: string;
  readonly ctaPrimaryFg: string;
  readonly ctaPrimaryBgPressed: string;
  readonly ctaSecondaryBg: string;
  readonly ctaGhostBg: string;
  readonly ctaGhostBorder: string;
}

export const Colors: TvColors = {
  // Backgrounds — alignés sur tokens.css web : surface-0 noir pur (OLED),
  // surface-1 pour les cartes. Même rendu que le desktop.
  bgDeep: "#000000",
  get bgSurface() { return SURFACE.s1; },
  get bgElevated() { return SURFACE.s3; },
  bgCard: "#0a0a0a",

  // Accents (live from shared)
  get accentPurple() { return BRAND.violet; },
  get accentPurpleLight() { return BRAND.light; },
  accentPink: "#ec4899",

  // Text (live)
  get textPrimary() { return TEXT.primary; },
  get textSecondary() { return TEXT.secondary; },
  get textTertiary() { return TEXT.tertiary; },
  get textMuted() { return TEXT.quaternary; },

  // Status (live)
  get success() { return STATUS.success; },
  get progressOrange() { return STATUS.warning; },
  get error() { return STATUS.error; },
  get ratingGold() { return STATUS.rating; },

  // Glassmorphism — teinte alignée sur --surface-modal web rgba(15,15,21,…)
  glassBg: "rgba(15, 15, 21, 0.80)",
  get glassBorder() { return BORDER.subtle; },
  glassBgHeavy: "rgba(15, 15, 21, 0.92)",

  // Overlays
  overlayDim: "rgba(0, 0, 0, 0.20)",
  overlayHeavy: "rgba(0, 0, 0, 0.60)",
  overlayGradientStart: "transparent",
  overlayGradientEnd: "#000000",

  // Focus (live brand glow)
  get focusGlow() { return BRAND.glow; },
  get focusBorder() { return BRAND.violet; },

  // Dividers — --border-subtle web
  divider: "rgba(255, 255, 255, 0.06)",
  border: "rgba(255, 255, 255, 0.08)",

  // CTA façon web/Netflix (--cta-* de tokens.css)
  ctaPrimaryBg: "#FFFFFF",
  ctaPrimaryFg: "#000000",
  ctaPrimaryBgPressed: "rgba(255, 255, 255, 0.85)",
  ctaSecondaryBg: "rgba(109, 109, 110, 0.55)",
  ctaGhostBg: "rgba(255, 255, 255, 0.08)",
  ctaGhostBorder: "rgba(255, 255, 255, 0.25)",
};

// Re-export shared tokens for convenience inside TV components.
export { BRAND, SURFACE, TEXT, STATUS, BORDER };

// ─── Spacing ─────────────────────────────────────────────────────────────────

/**
 * Teinte de marque à l'alpha donné, lue AU RENDU sur le token vivant : un
 * littéral `rgba(139, 92, 246, …)` court-circuite `applyThemeOverride()` — un
 * admin qui change la couleur de marque voyait ces zones rester violettes.
 */
export function brandAlpha(alpha: number): string {
  return withAlpha(BRAND.violet, alpha, `rgba(139, 92, 246, ${alpha})`);
}

export const Spacing = {
  /** Padding from screen edges (TV overscan-safe). */
  screenPadding: 32,
  /** Gouttière des rangées et des cartes bannière (`--row-gutter-desktop`). */
  rowGutter: TV_BANNER_CARD.gouttiere,
  /** Espace SOUS chaque rangée (web `mb-10`) et sous la carte bannière
   *  (hero web `pb-10`) — les rangées ne portent pas de marge haute. */
  rowGap: 40,
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

/**
 * Familles Inter par graisse (Android résout chaque fichier TTF comme une
 * famille distincte — `fontWeight` seul ne suffit pas pour 500/600/800).
 * Même police que le web (`tailwind.config.ts` → Inter).
 */
export const Fonts = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
  extrabold: "Inter-ExtraBold",
} as const;

export const Typography = {
  heroTitle: { fontSize: 34, fontWeight: "800" as const, fontFamily: Fonts.extrabold },
  sectionTitle: { fontSize: 20, fontWeight: "600" as const, fontFamily: Fonts.semibold },
  pageTitle: { fontSize: 22, fontWeight: "800" as const, fontFamily: Fonts.extrabold },
  detailTitle: { fontSize: 30, fontWeight: "800" as const, fontFamily: Fonts.extrabold },
  cardTitle: { fontSize: 16, fontWeight: "500" as const, fontFamily: Fonts.medium },
  meta: { fontSize: 16, fontWeight: "400" as const, fontFamily: Fonts.regular },
  synopsis: { fontSize: 16, fontWeight: "400" as const, fontFamily: Fonts.regular },
  buttonLarge: { fontSize: 16, fontWeight: "700" as const, fontFamily: Fonts.bold },
  buttonMedium: { fontSize: 16, fontWeight: "600" as const, fontFamily: Fonts.semibold },
  body: { fontSize: 16, fontWeight: "400" as const, fontFamily: Fonts.regular },
  caption: { fontSize: 14, fontWeight: "400" as const, fontFamily: Fonts.regular },
  /** Tagline above hero title — italic, dimmed. */
  tagline: { fontSize: 15, fontWeight: "400" as const, fontStyle: "italic" as const, fontFamily: Fonts.regular },
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
  /** Auto-rotate interval in ms (aligné HeroBillboard web : 8 s). */
  rotateInterval: 8_000,
  // Hauteur, fondu et forme de carte : `TV_BANNER_CARD` (@tentacle-tv/theme),
  // recroisé contre les feuilles de la LG par tvOnly.banner.test.ts.
  // Le Ken Burns a été retiré : la référence webOS n'en a pas.
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
  /** Crossfade duration when focused item changes — court pour que le fond
   *  suive la sélection sans traîner. */
  crossfadeDuration: 350,
  /** Image opacity over the page background. */
  imageOpacity: 0.32,
  /** Subtle vertical scrim to keep content legible. */
  scrimOpacity: 0.55,
} as const;
