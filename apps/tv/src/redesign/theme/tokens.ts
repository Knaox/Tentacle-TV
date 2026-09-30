import { StyleSheet, type TextStyle } from "react-native";
import { DEFAULT_COLOR_TOKENS, TV_ACCENT, TV_STAGE, TV_TYPE } from "@tentacle-tv/theme";

/**
 * Les jetons des vues de la refonte : les couleurs du BUREAU
 * (`DEFAULT_COLOR_TOKENS`), la scène TV (`TV_STAGE`, `TV_TYPE`) et l'accent,
 * la marque violet → rose (`TV_ACCENT`). Aucune valeur de couleur n'est
 * recopiée ici : on nomme, on ne redéfinit pas.
 */

const C = DEFAULT_COLOR_TOKENS;

export const colors = {
  /** Le fond racine du bureau, en dégradé « cinéma » (#000 → #070710). */
  bgTop: C.surface.s0,
  bgBottom: C.surface.s0Tint,
  surface1: C.surface.s1,
  surface2: C.surface.s2,
  surface3: C.surface.s3,
  text: C.text.primary,
  textSecondary: C.text.secondary,
  textTertiary: C.text.tertiary,
  textQuaternary: C.text.quaternary,
  ctaBg: C.cta.primaryBg,
  ctaFg: C.cta.primaryFg,
  ghost: C.cta.ghostBg,
  ghostStrong: C.cta.ghostBgHover,
  fillSoft: C.fill.soft,
  fillMedium: C.fill.medium,
  fillStrong: C.fill.strong,
  borderSubtle: C.border.subtle,
  borderStrong: C.border.strong,
  glassTint: C.glass.tint,
  glassTintStrong: C.glass.tintStrong,
  backdrop: C.glass.backdrop,
  onMedia: C.onMedia.primary,
  onMediaSecondary: C.onMedia.secondary,
  scrimRgb: C.onMedia.scrimRgb,
  success: C.status.success.base,
  warning: C.status.warning.base,
  error: C.status.error.base,
  errorFg: C.status.error.fg,
  accent: TV_ACCENT.base,
  accentLight: TV_ACCENT.light,
  accentDeep: TV_ACCENT.deep,
  onAccent: TV_ACCENT.onAccent,
  /** La lueur rose d'un élément de marque. */
  brandGlow: TV_ACCENT.glow,
} as const;

/** Le dégradé de marque, violet → rose (`BrandGradient` le pose). */
export const brandGradient: string[] = [...TV_ACCENT.gradient];

/** Voile noir à l'alpha voulu — les dégradés de lisibilité sur une image. */
export const scrim = (alpha: number) => `rgba(${C.onMedia.scrimRgb}, ${alpha})`;

/** Blanc à l'alpha voulu — reflets, liserés, remplissages du verre. */
export const white = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;

/** Inter, comme le bureau. Tant que l'app tvOS ne l'embarque pas, la graisse
 *  posée à côté garde le bon poids en police système. */
export const fonts = {
  regular: { fontFamily: "Inter-Regular", fontWeight: "400" },
  medium: { fontFamily: "Inter-Medium", fontWeight: "500" },
  semibold: { fontFamily: "Inter-SemiBold", fontWeight: "600" },
  bold: { fontFamily: "Inter-Bold", fontWeight: "700" },
  extrabold: { fontFamily: "Inter-ExtraBold", fontWeight: "800" },
} as const satisfies Record<string, TextStyle>;

export const type = TV_TYPE;
export const stage = TV_STAGE;

/** Les styles de texte de la scène. */
export const text = StyleSheet.create({
  display: { ...fonts.extrabold, fontSize: TV_TYPE.display, lineHeight: TV_TYPE.displayLineHeight, letterSpacing: -1.9, color: colors.text },
  title: { ...fonts.extrabold, fontSize: TV_TYPE.title, lineHeight: TV_TYPE.title * 1.08, letterSpacing: -1, color: colors.text },
  heading: { ...fonts.bold, fontSize: TV_TYPE.heading, lineHeight: TV_TYPE.heading * 1.15, letterSpacing: -0.4, color: colors.text },
  rowTitle: { ...fonts.bold, fontSize: TV_TYPE.rowTitle, lineHeight: TV_TYPE.rowTitle * 1.2, letterSpacing: -0.3, color: colors.text },
  body: { ...fonts.regular, fontSize: TV_TYPE.body, lineHeight: TV_TYPE.bodyLineHeight, color: colors.textSecondary },
  meta: { ...fonts.medium, fontSize: TV_TYPE.meta, lineHeight: TV_TYPE.meta * 1.3, color: colors.textSecondary },
  kicker: { ...fonts.bold, fontSize: TV_TYPE.kicker, letterSpacing: 4.4, textTransform: "uppercase", color: colors.accentLight },
  caption: { ...fonts.medium, fontSize: TV_TYPE.caption, lineHeight: TV_TYPE.caption * 1.3, color: colors.textTertiary },
  button: { ...fonts.bold, fontSize: TV_TYPE.button },
});
