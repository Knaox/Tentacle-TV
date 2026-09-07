import { StyleSheet } from "react-native";
import { typography, FONT_FAMILY, withAlpha, type AppTheme } from "@/theme";

/**
 * Le texte du bandeau (étiquettes, logo, titre, méta, synopsis, progression),
 * partagé par le contenu en ligne (`HeroBannerContent`) et son jumeau hors
 * ligne (`OfflineHeroContent`) : un seul dessin, deux sources de données.
 */
// Tout le contenu du Hero est posé DIRECTEMENT sur l'affiche → texte via
// onMedia.* (blanc + voile sombre, constant dans les deux thèmes) pour rester
// lisible sur n'importe quelle image, thème clair inclus. `overview` garde son
// halo via onMedia.shadow. Rendu sombre inchangé (mêmes valeurs blanches).
export const makeHeroTextStyles = (t: AppTheme) => StyleSheet.create({
  tagRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 12, flexWrap: "wrap" as const },
  // Pastille contrastée sur image : violette en clair, blanche en sombre (cta.primaryBg).
  continueTag: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, backgroundColor: t.colors.cta.primaryBg, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 3 },
  continueTagTxt: { fontSize: 9.5, fontFamily: FONT_FAMILY.extrabold, color: t.colors.cta.primaryFg, letterSpacing: 1.6, textTransform: "uppercase" as const },
  epLabel: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.onMedia.secondary, letterSpacing: 0.2 },
  logo: { width: 280, maxWidth: "85%", height: 92, marginBottom: 14 },
  title: { fontSize: 32, fontFamily: FONT_FAMILY.extrabold, color: t.colors.onMedia.primary, marginBottom: 14, letterSpacing: -0.6, lineHeight: 36, textShadowColor: t.colors.onMedia.shadow, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12 },
  meta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 10, flexWrap: "wrap" as const },
  metaTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.onMedia.secondary },
  metaTxtMuted: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.onMedia.secondary },
  rBadge: { borderWidth: 1, borderColor: withAlpha(t.colors.onMedia.primary, 0.45, t.colors.border.strong), borderRadius: 3, paddingHorizontal: 5, paddingVertical: 0.5 },
  rBadgeTxt: { fontSize: 9, fontFamily: FONT_FAMILY.bold, color: t.colors.onMedia.secondary, letterSpacing: 0.6 },
  ratingBox: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
  rating: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.status.rating },
  overview: { ...typography.body, fontFamily: FONT_FAMILY.regular, color: t.colors.onMedia.secondary, lineHeight: 21, marginBottom: 18, textShadowColor: t.colors.onMedia.shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  progRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 18, maxWidth: 280 },
  progTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: t.colors.fill.strong, overflow: "hidden" as const },
  progFill: {
    height: "100%" as const, borderRadius: 2,
    // Halo rose du bureau (--progress-glow) — iOS ; Android reste net.
    shadowColor: t.colors.brand.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 5,
  },
  progLbl: { fontSize: 11, fontFamily: FONT_FAMILY.bold, color: t.colors.onMedia.secondary },
});
