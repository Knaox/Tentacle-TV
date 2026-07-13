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
  };
  /** Surfaces d'action destructive (ex-colors.dangerSurface/dangerBorder). */
  danger: {
    surface: string;
    border: string;
  };
  /**
   * Formule verre unifiée (GlassSurface) : voile posé sous le BlurView.
   * `panel` = fond opaque des sheets (BottomSheet, MediaActionSheet).
   */
  glass: {
    tint: string;
    tintStrong: string;
    panel: string;
  };
  /** Fond de la tab bar (opaque hors Liquid Glass). */
  tabBar: string;
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
