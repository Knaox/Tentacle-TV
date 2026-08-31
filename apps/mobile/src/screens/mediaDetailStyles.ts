import { StyleSheet } from "react-native";
import { spacing, typography, FONT_FAMILY, RADIUS, type AppTheme } from "../theme";

/**
 * Styles du MediaDetailScreen — factory thémée light/dark (extraits pour garder
 * l'écran sous 300 lignes). Consommée via `useThemedStyles(makeMediaDetailStyles)`
 * par DetailHeader / DetailBody.
 */
export const makeMediaDetailStyles = (t: AppTheme) => {
  // CTA Lecture : même dessin que la pilule « Lire » du hero (HeroBannerContent
  // — playBtn) : ombre neutre en clair, portée noire en sombre. Changer l'un
  // sans l'autre recréerait l'écart accueil/fiche corrigé en 1.6.0.
  const playShadow = t.isDark
    ? { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }
    : t.colors.shadow.card;
  return StyleSheet.create({
    watchedRing: { position: "absolute" as const, top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.cta.primaryBg, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 },
    seriesLabel: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light, marginBottom: 4, letterSpacing: 0.2 },
    seriesLink: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginBottom: 4 },
    // Titre posé sur le bas du backdrop → onMedia (blanc + voile sombre) pour
    // rester lisible sur l'affiche dans les deux thèmes (fix contraste clair).
    title: { fontSize: 26, fontFamily: FONT_FAMILY.extrabold, color: t.colors.onMedia.primary, lineHeight: 30, letterSpacing: -0.6, textShadowColor: t.colors.onMedia.shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
    metaRow: { flexDirection: "row" as const, gap: 6, marginTop: 8, flexWrap: "wrap" as const, alignItems: "center" as const },
    metaItem: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    metaDot: { ...typography.caption, color: t.colors.text.quaternary },
    ratingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
    ratingTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.status.rating },
    badgeRow: { flexDirection: "row" as const, gap: 6, marginTop: 10, flexWrap: "wrap" as const },
    sectionTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl, marginBottom: 4 },
    playBtn: {
      flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
      gap: 10, backgroundColor: t.colors.cta.primaryBg, borderRadius: RADIUS.pill, height: 52, paddingHorizontal: 28,
      borderWidth: t.colors.cta.primaryBorder ? 1 : 0, borderColor: t.colors.cta.primaryBorder, ...playShadow,
    },
    playBtnTxt: { ...typography.bodyBold, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg, letterSpacing: 0.2, fontSize: 16 },
    genreRow: { flexDirection: "row" as const, gap: 6, marginTop: spacing.xl, paddingHorizontal: spacing.screenPadding, flexWrap: "wrap" as const },
    overview: { ...typography.body, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary, lineHeight: 22 },
    expandLink: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light, marginTop: 8 },
  });
};
