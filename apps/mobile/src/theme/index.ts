/**
 * Theme mobile — exposition publique.
 *
 * Les modules `colors`, `typography`, `spacing` sont en back-compat avec les
 * 48+ écrans/composants existants (mêmes clés, valeurs alignées sur le nouveau
 * langage cinématographique).
 *
 * Le hub `tokens` (nouveaux composants UI) expose les tokens partagés bruts
 * (BRAND, SURFACE, CTA, etc.) ainsi que les helpers mobile-only (HAPTICS,
 * getFont, preset).
 */

export { colors } from "./colors";
export { typography } from "./typography";
export { spacing } from "./spacing";

export * from "./tokens";
export * as motion from "./motion";
export * as effects from "./effects";

// Theming runtime : MARQUE (admin, `/api/theme`) × APPARENCE (light/dark/auto).
export {
  ThemeProvider,
  BrandThemeContext,
  useBrandTheme,
  type BrandThemeContextValue,
} from "./ThemeProvider";
export {
  AppThemeContext,
  ThemePrefsContext,
  DEFAULT_APP_THEME,
  buildAppTheme,
  useTheme,
  useThemeMode,
  type LiquidGlassPrefs,
  type ThemePrefsValue,
} from "./appThemeContext";
export { useThemedStyles, type ThemedStyleFactory } from "./useThemedStyles";
export type {
  AppTheme,
  ResolvedScheme,
  ThemeMode,
  ThemePalette,
} from "./palette.types";
export { buildDarkPalette } from "./palette.dark";
export { buildLightPalette } from "./palette.light";
export {
  THEME_MODE_STORAGE_KEY,
  applyAppearance,
  getBootThemeMode,
  sanitizeThemeMode,
  setBootThemeMode,
} from "./themeMode";
export { PLAYER } from "./playerColors";
export { darken, hexToRgb, withAlpha, type Rgb } from "./colorUtils";
export { fetchThemeState } from "./themeApi";
export type { BackendThemeState } from "./types";
export { parsePx, parseMs, parseScale } from "./utils";

// Responsive / iPad — helpers d'adaptation tablette (l'iPhone reste inchangé).
export {
  useResponsive,
  useGrid,
  useContentPadding,
  useRailWidth,
  RailWidthContext,
  TABLET_MIN_WIDTH,
  IS_PAD_DEVICE,
  IS_TABLET_DEVICE,
  CONTENT_MAX_WIDTH,
  DETAIL_MAX_WIDTH,
  SHEET_MAX_WIDTH,
  type Responsive,
  type GridLayout,
  type GridOptions,
} from "./responsive";
