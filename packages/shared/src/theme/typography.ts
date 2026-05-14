/**
 * Shared typography tokens — cross-platform (web/TV/mobile).
 *
 * Pure module: fontWeight is typed as string literal (not React Native's
 * TextStyle["fontWeight"]) to stay platform-agnostic. Each platform maps the
 * literal weights to its own type.
 *
 * Mobile uses Inter loaded via expo-font / @expo-google-fonts/inter.
 * Web imports Inter from Google Fonts in apps/web/src/index.css.
 */

export type FontWeightLiteral = "300" | "400" | "500" | "600" | "700" | "800";

/** Font family aliases — match @expo-google-fonts/inter package exports. */
export const FONT_FAMILY = {
  light: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

export const FONT_WEIGHT: Record<keyof typeof FONT_FAMILY, FontWeightLiteral> = {
  light: "300",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
};

/** Font sizes (px) — display tiers scaled down for mobile vs web. */
export const FONT_SIZE = {
  "display-1": 56,
  "display-2": 44,
  "display-3": 32,
  "heading-1": 24,
  "heading-2": 20,
  "heading-3": 18,
  body: 15,
  bodyLg: 16,
  caption: 13,
  small: 11,
  badge: 10,
} as const;

/** Letter-spacing (px — RN does not support em units). */
export const LETTER_SPACING = {
  /** Tight display headings. */
  tight: -0.5,
  /** Headings (h1/h2/h3). */
  headingsTight: -0.4,
  /** Body text — subtle negative tracking. */
  body: -0.075,
  /** Uppercase badges/labels. */
  wide: 0.3,
} as const;

export const LINE_HEIGHT = {
  display: 1.05,
  heading: 1.25,
  body: 1.5,
} as const;

/** Pre-composed type presets — used by both web and mobile. */
export const TYPE_PRESETS = {
  display1: { fontSize: FONT_SIZE["display-1"], fontWeight: FONT_WEIGHT.extrabold, letterSpacing: LETTER_SPACING.tight },
  display2: { fontSize: FONT_SIZE["display-2"], fontWeight: FONT_WEIGHT.bold, letterSpacing: LETTER_SPACING.tight },
  display3: { fontSize: FONT_SIZE["display-3"], fontWeight: FONT_WEIGHT.bold, letterSpacing: LETTER_SPACING.headingsTight },
  heading1: { fontSize: FONT_SIZE["heading-1"], fontWeight: FONT_WEIGHT.semibold, letterSpacing: LETTER_SPACING.headingsTight },
  heading2: { fontSize: FONT_SIZE["heading-2"], fontWeight: FONT_WEIGHT.semibold, letterSpacing: LETTER_SPACING.headingsTight },
  heading3: { fontSize: FONT_SIZE["heading-3"], fontWeight: FONT_WEIGHT.semibold, letterSpacing: LETTER_SPACING.headingsTight },
  body: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.regular, letterSpacing: LETTER_SPACING.body },
  bodyBold: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, letterSpacing: LETTER_SPACING.body },
  caption: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.regular, letterSpacing: LETTER_SPACING.body },
  small: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0 },
  badge: { fontSize: FONT_SIZE.badge, fontWeight: FONT_WEIGHT.bold, letterSpacing: LETTER_SPACING.wide },
} as const;

export type FontFamilyKey = keyof typeof FONT_FAMILY;
export type TypePresetKey = keyof typeof TYPE_PRESETS;
