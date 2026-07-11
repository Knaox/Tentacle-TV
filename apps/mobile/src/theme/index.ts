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

// Runtime theming (Phase 4 — consumes `@tentacle-tv/theme` + `/api/theme`).
export {
  ThemeProvider,
  ThemeContext,
  useTheme,
  type ThemeContextValue,
} from "./ThemeProvider";
export { fetchThemeState } from "./themeApi";
export type { BackendThemeState } from "./types";
export { parsePx, parseMs, parseScale } from "./utils";

// Responsive / iPad — helpers d'adaptation tablette (l'iPhone reste inchangé).
export {
  useResponsive,
  useGrid,
  useContentPadding,
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
