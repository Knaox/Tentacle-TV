/**
 * Typographie mobile — back-compat. Préserve les 8 presets historiques (hero,
 * title, subtitle, body, bodyBold, caption, small, badge) consommés par ~27
 * fichiers, mais injecte la `fontFamily` Inter (chargée via expo-font) et le
 * letter-spacing pour s'aligner sur le langage typographique web.
 *
 * Note : `fontFamily` n'écrasera l'apparence que lorsque Inter sera chargée par
 * `useAppFonts()`. Si Inter n'est pas dispo, RN tombe en fallback system font
 * automatiquement (cf. Task #4).
 */

import type { TextStyle } from "react-native";
import { FONT_FAMILY, LETTER_SPACING } from "@tentacle-tv/shared";

export const typography = {
  hero: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: FONT_FAMILY.extrabold,
    letterSpacing: LETTER_SPACING.tight,
  } as TextStyle,
  title: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: FONT_FAMILY.extrabold,
    letterSpacing: LETTER_SPACING.headingsTight,
  } as TextStyle,
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: FONT_FAMILY.bold,
    letterSpacing: LETTER_SPACING.headingsTight,
  } as TextStyle,
  body: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: FONT_FAMILY.regular,
    letterSpacing: LETTER_SPACING.body,
  } as TextStyle,
  bodyBold: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: LETTER_SPACING.body,
  } as TextStyle,
  caption: {
    fontSize: 13,
    fontWeight: "400",
    fontFamily: FONT_FAMILY.regular,
    letterSpacing: LETTER_SPACING.body,
  } as TextStyle,
  small: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: FONT_FAMILY.semibold,
  } as TextStyle,
  badge: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: FONT_FAMILY.bold,
    letterSpacing: LETTER_SPACING.wide,
  } as TextStyle,
} as const;
