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
// Les convertisseurs vivent dans `@tentacle-tv/theme` : ils servent aussi la
// cible webOS, et une copie locale avait déjà pris la poussière ici sans qu'un
// seul appelant s'en serve. Ré-exportés pour que les écrans n'aient pas à
// connaître deux origines de thème.
export {
  parseMs,
  parsePx,
  parseScale,
  parseShadow,
  type NativeShadow,
} from "@tentacle-tv/theme";

// La couche téléviseur, en nombres : mêmes valeurs que la feuille de la LG.
// Elles ne remplacent pas encore `Radius`/`Spacing` ci-dessous — l'alignement
// visuel est une décision qui se voit, et il se fait en P3, devant l'écran.
export {
  TV_AMBILIGHT_BLUR,
  TV_COLORS,
  TV_LAYERS,
  TV_OVERSCAN_PT,
  TV_RADIUS,
  TV_SHADOW,
} from "@tentacle-tv/theme";
export {
  Colors, Spacing, Typography, Fonts, Radius,
  HeroConfig, CardConfig, AmbientConfig,
} from "./colors";
export { Durations, Easings } from "./motion";
