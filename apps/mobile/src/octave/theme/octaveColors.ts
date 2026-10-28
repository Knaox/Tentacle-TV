/**
 * Octave (mobile) — les jetons du mode, tirés du thème de Tentacle comme ceux
 * du bureau (`octaveTokens.css`) : l'encre pour la page, le ROSE pour l'accent
 * (le rose clair en texte, ≥ 4,5:1 sur l'encre), le dégradé violet → rose en
 * touches. Jamais une couleur en dur dans un écran : ces jetons.
 */

import { useMemo } from "react";
import { useTheme, withAlpha } from "@/theme";

export interface OctaveColors {
  ink: string;
  raised: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  /** Le rose LISIBLE en texte et en petit glyphe. */
  accentText: string;
  /** Un fond rose discret (onglet actif, pastille) — jamais sous du texte rose. */
  accentSoft: string;
  line: string;
  /** Le survol / l'appui d'une ligne. */
  pressed: string;
  /** La signature : violet → rose (progression, marque, bouton Lecture). */
  gradient: readonly [string, string, string];
  /**
   * Le remplissage de l'action principale (« Lecture », et l'unique bouton
   * d'appel d'une feuille) : violet → rose, celui du gros bouton du lecteur.
   * Jamais `cta.brandBg` (le violet seul) dans Octave : `OctaveBrandFill`.
   */
  brandFill: readonly [string, string];
  /** Le texte et le glyphe posés sur `brandFill`. */
  onBrandFill: string;
  isDark: boolean;
}

export function useOctaveColors(): OctaveColors {
  const { colors, isDark } = useTheme();
  return useMemo(
    () => ({
      ink: colors.surface.s0,
      raised: colors.surface.s1,
      text: colors.text.primary,
      textSecondary: colors.text.secondary,
      textTertiary: colors.text.tertiary,
      accent: colors.brand.accent,
      accentText: isDark ? colors.brand.accentLight : colors.brand.accentDark,
      accentSoft: withAlpha(colors.brand.accent, 0.16, colors.brand.soft),
      line: colors.border.subtle,
      pressed: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      gradient: [colors.brand.violet, colors.brand.accent, colors.brand.accentLight] as const,
      brandFill: [colors.brand.violet, colors.brand.accent] as const,
      onBrandFill: colors.cta.brandFg,
      isDark,
    }),
    [colors, isDark],
  );
}
