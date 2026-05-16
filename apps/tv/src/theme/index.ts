/**
 * TV theme runtime — additive layer on top of the existing legacy modules
 * (`./colors`, `./focus`, `./motion`). Components keep importing those
 * directly until Phase 4b migrates them to `useTheme()`.
 */
export {
  ThemeProvider,
  ThemeContext,
  useTheme,
  type ThemeContextValue,
} from "./ThemeProvider";
export { fetchThemeState } from "./themeApi";
export type { BackendThemeState } from "./types";
export { parsePx, parseMs, parseScale } from "./utils";
