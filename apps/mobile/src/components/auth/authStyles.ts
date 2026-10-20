/**
 * Styles partagés pour les écrans d'authentification (Login, Register,
 * ForgotPassword, ServerSetup). Centralise les tokens visuels : card glass,
 * inputs, CTAs pill halo violet, liens brand.light.
 *
 * Feuille THÉMÉE (clair/sombre) : consommer via
 * `const auth = useThemedStyles(makeAuthStyles);` puis `auth.title`, etc.
 */

import { StyleSheet } from "react-native";

import { FONT_FAMILY, RADIUS, type AppTheme } from "../../theme";

export { GlassCard } from "../ui/GlassCard";
export { SubtleBackground } from "../ui/SubtleBackground";
export { FadeIn } from "../ui/FadeIn";

export const makeAuthStyles = (t: AppTheme) =>
  StyleSheet.create({
    title: {
      color: t.colors.text.primary,
      fontSize: 28,
      fontFamily: FONT_FAMILY.extrabold,
      fontWeight: "800",
      letterSpacing: -0.6,
      textAlign: "center",
      marginBottom: 6,
    },
    subtitle: {
      color: t.colors.brand.light,
      fontSize: 13,
      fontFamily: FONT_FAMILY.medium,
      fontWeight: "500",
      letterSpacing: 0.3,
      textAlign: "center",
      marginBottom: 24,
    },
    input: {
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      borderRadius: RADIUS.md,
      paddingHorizontal: 16,
      height: 44,
      color: t.colors.text.primary,
      fontSize: 15,
      fontFamily: FONT_FAMILY.regular,
    },
    /**
     * CTA primaire — la pilule blanche (cta.primaryBg), sans halo : le halo
     * violet de 22 pt faisait d'un formulaire un écran coloré (système de
     * boutons, 20/10). Le contour du thème clair la détache du fond.
     */
    primaryCta: {
      backgroundColor: t.colors.cta.primaryBg,
      borderRadius: RADIUS.md,
      paddingVertical: 13,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 46,
      borderWidth: t.colors.cta.primaryBorder ? 1 : 0,
      borderColor: t.colors.cta.primaryBorder,
    },
    /** Lien brand.light Inter Medium. */
    link: {
      color: t.colors.brand.light,
      fontSize: 13,
      fontFamily: FONT_FAMILY.medium,
      fontWeight: "500",
      letterSpacing: 0.2,
    },
    /** CTA secondaire ghost — bg violet 18 % + border violet glow. */
    secondaryCta: {
      backgroundColor: t.colors.brand.ghost,
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
      borderRadius: RADIUS.md,
      paddingVertical: 13,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 46,
    },
  });
