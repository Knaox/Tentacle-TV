/**
 * Styles partagés pour les écrans d'authentification (Login, Register,
 * ForgotPassword, ServerSetup). Centralise les tokens visuels : card glass,
 * inputs, CTAs pill blanc halo violet, liens BRAND.light.
 */

import type { TextStyle, ViewStyle } from "react-native";
import {
  BORDER,
  BRAND,
  CTA,
  FONT_FAMILY,
  RADIUS,
} from "../../theme";

export { GlassCard } from "../ui/GlassCard";
export { SubtleBackground } from "../ui/SubtleBackground";
export { FadeIn } from "../ui/FadeIn";
export { BORDER, BRAND, CTA, FONT_FAMILY, RADIUS, STATUS } from "../../theme";

export const authTitleStyle: TextStyle = {
  color: "#FFFFFF",
  fontSize: 28,
  fontFamily: FONT_FAMILY.extrabold,
  fontWeight: "800",
  letterSpacing: -0.6,
  textAlign: "center",
  marginBottom: 6,
};

export const authSubtitleStyle: TextStyle = {
  color: BRAND.light,
  fontSize: 13,
  fontFamily: FONT_FAMILY.medium,
  fontWeight: "500",
  letterSpacing: 0.3,
  textAlign: "center",
  marginBottom: 24,
};

export const authInputStyle: TextStyle = {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: BORDER.subtle,
  borderRadius: RADIUS.md,
  paddingHorizontal: 16,
  height: 44,
  color: "#FFFFFF",
  fontSize: 15,
  fontFamily: FONT_FAMILY.regular,
};

/** CTA primaire — pill blanc avec halo violet. */
export const authPrimaryCtaStyle: ViewStyle = {
  backgroundColor: CTA.primaryBg,
  borderRadius: RADIUS.md,
  paddingVertical: 13,
  paddingHorizontal: 20,
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
  shadowColor: BRAND.violet,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.55,
  shadowRadius: 22,
  elevation: 12,
};

/** Lien BRAND.light Inter Medium. */
export const authLinkStyle: TextStyle = {
  color: BRAND.light,
  fontSize: 13,
  fontFamily: FONT_FAMILY.medium,
  fontWeight: "500",
  letterSpacing: 0.2,
};

/** CTA secondaire ghost — bg violet 18% + border violet 40%. */
export const authSecondaryCtaStyle: ViewStyle = {
  backgroundColor: BRAND.ghost,
  borderWidth: 1,
  borderColor: "rgba(139, 92, 246, 0.4)",
  borderRadius: RADIUS.md,
  paddingVertical: 13,
  paddingHorizontal: 20,
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
};
