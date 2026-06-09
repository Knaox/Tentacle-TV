import { StyleSheet } from "react-native";
import { colors, spacing, typography, BRAND, CTA, FONT_FAMILY, RADIUS, SHADOW_RN } from "../theme";

/** Styles du MediaDetailScreen — extraits pour garder l'écran sous 300 lignes. */
export const st = StyleSheet.create({
  watchedRing: { position: "absolute" as const, top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 },
  seriesLabel: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: BRAND.light, marginBottom: 4, letterSpacing: 0.2 },
  seriesLink: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginBottom: 4 },
  title: { fontSize: 26, fontFamily: FONT_FAMILY.extrabold, color: colors.textPrimary, lineHeight: 30, letterSpacing: -0.6, textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  metaRow: { flexDirection: "row" as const, gap: 6, marginTop: 8, flexWrap: "wrap" as const, alignItems: "center" as const },
  metaItem: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: "rgba(255,255,255,0.78)" },
  metaDot: { ...typography.caption, color: "rgba(255,255,255,0.34)" },
  ratingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
  ratingTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: "#FBBF24" },
  badgeRow: { flexDirection: "row" as const, gap: 6, marginTop: 10, flexWrap: "wrap" as const },
  sectionTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: colors.textPrimary, paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl, marginBottom: 4 },
  playBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 10, backgroundColor: CTA.primaryBg, borderRadius: RADIUS.md, height: 52, paddingHorizontal: 28, ...SHADOW_RN.elev2,
  },
  playBtnTxt: { ...typography.bodyBold, fontFamily: FONT_FAMILY.bold, color: CTA.primaryFg, letterSpacing: 0.2, fontSize: 16 },
  genreRow: { flexDirection: "row" as const, gap: 6, marginTop: spacing.xl, paddingHorizontal: spacing.screenPadding, flexWrap: "wrap" as const },
  overview: { ...typography.body, fontFamily: FONT_FAMILY.regular, color: "rgba(255,255,255,0.82)", lineHeight: 22 },
  expandLink: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: BRAND.light, marginTop: 8 },
});
