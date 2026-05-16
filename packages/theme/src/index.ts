/**
 * Public API of `@tentacle-tv/theme`.
 *
 * - Types: `Theme`, `ThemeTokens`, plus per-category interfaces.
 * - Defaults: `DEFAULT_THEME`, `DEFAULT_THEME_TOKENS`.
 * - Runtime: `mergeTheme`, `mergeThemeTokens` for applying overrides.
 * - CSS bridge: `themeToCssVariables`, `themeToCssVarEntries`, `CSS_VAR_NAMES`,
 *   `cssVar`.
 * - Tailwind: preset re-exported via the `./tailwind` subpath.
 */

export type {
  BlurTokens,
  BorderColorTokens,
  BrandColorTokens,
  ColorTokens,
  ComponentSizeTokens,
  CssVarNameMap,
  CtaColorTokens,
  DeepPartial,
  LayoutTokens,
  MotionDurationTokens,
  MotionEasingTokens,
  MotionTokens,
  PartialTheme,
  PartialThemeTokens,
  RadiusTokens,
  ShadowTokens,
  SpacingTokens,
  StatusColorTokens,
  StatusToneTokens,
  SurfaceColorTokens,
  TextColorTokens,
  Theme,
  ThemeTokens,
  TypographyFontFamily,
  TypographyFontSize,
  TypographyTokens,
} from "./types";

export {
  DEFAULT_THEME,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_TOKENS,
} from "./defaults";

export {
  DEFAULT_BLUR_TOKENS,
  DEFAULT_COLOR_TOKENS,
  DEFAULT_COMPONENT_TOKENS,
  DEFAULT_LAYOUT_TOKENS,
  DEFAULT_MOTION_TOKENS,
  DEFAULT_RADIUS_TOKENS,
  DEFAULT_SHADOW_TOKENS,
  DEFAULT_SPACING_TOKENS,
  DEFAULT_TYPOGRAPHY_TOKENS,
} from "./tokens";

export { mergeTheme, mergeThemeTokens } from "./merge";

export {
  CSS_VAR_NAMES,
  cssVar,
} from "./css/varNames";

export type { CssEmittedTokens } from "./css/varNames";

export { REDUCED_MOTION_OVERRIDES } from "./css/reducedMotion";

export {
  themeToCssVariables,
  themeToCssVarEntries,
  partialThemeToCssVarEntries,
  type ToCssVariablesOptions,
} from "./css/toCssVariables";

export { tentacleTailwindPreset } from "./tailwind/preset";
