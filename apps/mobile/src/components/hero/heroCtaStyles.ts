import { StyleSheet } from "react-native";
import { FONT_FAMILY, RADIUS, withAlpha, type AppTheme } from "@/theme";

/**
 * Les pilules d'action du bandeau, partagées par les diapositives Jellyfin et
 * les diapositives de recommandation : « Lire » au dégradé de marque
 * (`HeroPlayButton`, `ctaGradient` — comme l'Apple TV ; un voile noir à
 * l'appui), « Plus d'infos » en verre sombre constant posé sur l'affiche
 * (jamais les tokens ghost de page). Tablette : plus larges.
 */
export const makeHeroCtaStyles = (t: AppTheme) => StyleSheet.create({
  btns: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  // L'ombre vit sur l'enveloppe : la pilule rogne (`overflow`) son voile d'appui.
  playWrap: {
    borderRadius: RADIUS.pill,
    ...(t.isDark
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }
      : t.colors.shadow.card),
  },
  playBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 9,
    borderRadius: RADIUS.pill, minHeight: 44, paddingVertical: 12, paddingHorizontal: 26, overflow: "hidden" as const,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255, 255, 255, 0.2)",
  },
  playBtnTablet: { paddingVertical: 16, paddingHorizontal: 34 },
  // Appui : un voile NOIR — il approfondit le dégradé (le contraste monte) au
  // lieu de l'estomper sur l'affiche comme une opacité réduite.
  playVeil: { backgroundColor: "#000", opacity: 0 },
  playVeilPressed: { opacity: 0.18 },
  playTxt: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.brandFg, letterSpacing: 0.1 },
  infoBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    backgroundColor: "rgba(10, 10, 16, 0.45)", borderRadius: RADIUS.pill, minHeight: 44, paddingVertical: 12, paddingHorizontal: 20,
    borderWidth: 1, borderColor: withAlpha(t.colors.onMedia.primary, 0.28, t.colors.border.strong),
  },
  infoBtnTablet: { paddingVertical: 16, paddingHorizontal: 24 },
  infoTxt: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.onMedia.primary },
  pressed: { opacity: 0.88 },
});
