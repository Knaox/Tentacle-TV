import { StyleSheet } from "react-native";
import { FONT_FAMILY, RADIUS, withAlpha, type AppTheme } from "@/theme";

/**
 * Les pilules d'action du bandeau, partagées par les diapositives Jellyfin et
 * les diapositives de recommandation : « Lire » en blanc à l'ombre NEUTRE,
 * « Plus d'infos » en verre sombre constant posé sur l'affiche (jamais les
 * tokens ghost de page). Tablette : plus larges.
 */
export const makeHeroCtaStyles = (t: AppTheme) => StyleSheet.create({
  btns: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  playBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 9,
    backgroundColor: t.colors.cta.primaryBg, borderRadius: RADIUS.pill, minHeight: 44, paddingVertical: 12, paddingHorizontal: 26,
    borderWidth: t.colors.cta.primaryBorder ? 1 : 0, borderColor: t.colors.cta.primaryBorder,
    ...(t.isDark
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }
      : t.colors.shadow.card),
  },
  playBtnTablet: { paddingVertical: 16, paddingHorizontal: 34 },
  playTxt: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg, letterSpacing: 0.1 },
  infoBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    backgroundColor: "rgba(10, 10, 16, 0.45)", borderRadius: RADIUS.pill, minHeight: 44, paddingVertical: 12, paddingHorizontal: 20,
    borderWidth: 1, borderColor: withAlpha(t.colors.onMedia.primary, 0.28, t.colors.border.strong),
  },
  infoBtnTablet: { paddingVertical: 16, paddingHorizontal: 24 },
  infoTxt: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.onMedia.primary },
  pressed: { opacity: 0.88 },
});
