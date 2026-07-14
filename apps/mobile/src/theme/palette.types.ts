/**
 * Types du système d'apparence clair/sombre — apps/mobile uniquement.
 *
 * `ThemePalette` est un instantané immutable construit par `buildDarkPalette()`
 * / `buildLightPalette()` à partir des tokens de marque partagés (lus APRÈS
 * `applyThemeOverride`, donc brand-aware). `AppTheme` ajoute le scheme résolu
 * et ses dérivés pratiques (statusBarStyle, blurTint).
 *
 * Les tokens light/dark vivent ici (mobile) et non dans packages/shared :
 * la TV et le web restent dark, et `applyThemeOverride` reset toujours vers
 * les défauts sombres — voir plan de refonte thème.
 */

import type { ViewStyle } from "react-native";

/** Choix utilisateur persisté ("auto" suit le réglage système). */
export type ThemeMode = "light" | "dark" | "auto";

/** Scheme effectif après résolution du mode auto. */
export type ResolvedScheme = "light" | "dark";

export interface ThemePalette {
  brand: {
    /** Accent principal (violet marque en dark, nuance lisible en light). */
    violet: string;
    light: string;
    dark: string;
    glow: string;
    soft: string;
    ghost: string;
  };
  surface: {
    /** Fond racine de l'app. */
    s0: string;
    s1: string;
    s2: string;
    s3: string;
    overlay: string;
    /** Fin du dégradé cinématique du fond racine (SubtleBackground). */
    s0Tint: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
    disabled: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
    rating: string;
  };
  statusPairs: Record<
    "success" | "warning" | "error" | "info",
    { bg: string; fg: string }
  >;
  border: {
    subtle: string;
    strong: string;
    focus: string;
  };
  cta: {
    primaryBg: string;
    primaryBgHover: string;
    primaryFg: string;
    secondaryBg: string;
    secondaryBgHover: string;
    secondaryFg: string;
    ghostBg: string;
    ghostBgHover: string;
    ghostFg: string;
    brandBg: string;
    brandBgHover: string;
    brandFg: string;
    /**
     * Contour du CTA PRINCIPAL. En CLAIR, un léger liseré sombre définit le
     * bouton blanc sur fond clair (style « blanc + fin contour noir » +
     * ombre douce + texte violet profond). `undefined` en sombre (pilule
     * blanche pleine sans bord).
     */
    primaryBorder?: string;
  };
  overlay: {
    scrim: string;
    scrimSoft: string;
    scrimHeavy: string;
  };
  /**
   * Remplissages neutres translucides — remplacent les rgba(255,255,255,x)
   * épars du code (inversés en light : rgba noirs).
   */
  fill: {
    faint: string;
    subtle: string;
    soft: string;
    medium: string;
    /** Grips, poignées, pistes actives (ex-handle 0.28). */
    strong: string;
    /** Reflet du shimmer des skeletons (reste un éclat CLAIR en light). */
    shimmer: string;
  };
  /** Surfaces d'action destructive (ex-colors.dangerSurface/dangerBorder). */
  danger: {
    surface: string;
    border: string;
  };
  /**
   * Formule verre unifiée (GlassSurface) : voile posé sous le BlurView.
   * `panel` = fond opaque des sheets (BottomSheet, MediaActionSheet).
   * `backdrop` = scrim canonique des fonds de modale (reste sombre en light).
   */
  glass: {
    tint: string;
    tintStrong: string;
    panel: string;
    backdrop: string;
  };
  /** Fond de la tab bar (opaque hors Liquid Glass). */
  tabBar: string;
  /**
   * Texte posé DIRECTEMENT sur une image (backdrop/poster) — Hero, cartes
   * bibliothèque, titre de fiche. CONSTANT entre les deux thèmes : la
   * luminosité d'une affiche est indépendante du thème choisi, donc on reste
   * blanc-sur-voile-sombre dans les deux modes (standard iOS/Netflix). Évite
   * le texte quasi-noir + ombre noire illisible en clair.
   */
  onMedia: {
    primary: string;
    secondary: string;
    /** Couleur du textShadow (voile sombre porté par le texte). */
    shadow: string;
  };
  /**
   * Ombres portées des surfaces verre / cartes (RN ViewStyle partiel). Douces
   * en clair pour que les cartes se détachent du fond nacré ; en sombre les
   * cartes ne portent pas d'ombre (rendu inchangé, GlassSurface l'ignore).
   */
  shadow: {
    card: ViewStyle;
    sheet: ViewStyle;
  };
}

export interface AppTheme {
  scheme: ResolvedScheme;
  isDark: boolean;
  colors: ThemePalette;
  /** Pour expo-status-bar : "light" en sombre, "dark" en clair. */
  statusBarStyle: "light" | "dark";
  /** Tint expo-blur aligné sur le scheme. */
  blurTint: ResolvedScheme;
}
