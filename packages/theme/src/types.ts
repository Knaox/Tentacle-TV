/**
 * Token shape for the Tentacle TV theming system.
 *
 * Source of authority: `apps/web/src/theme/tokens.css`. Every leaf value here
 * has a 1:1 counterpart in that file (lossless migration). Values are stored
 * as strings (CSS units preserved) so they can be emitted as CSS variables
 * verbatim and consumed by React Native via simple parsing.
 */

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export interface SurfaceColorTokens {
  s0: string;
  s1: string;
  s2: string;
  s3: string;
  overlay: string;
  modal: string;
  dropdown: string;
  sheet: string;
  toolbar: string;
}

export interface BrandColorTokens {
  base: string;
  /**
   * Brand color as a comma-separated RGB triplet ("R, G, B"). Used inside
   * `rgba(var(--brand-rgb), X)` so every opacity variant of the brand color
   * follows the base color automatically when overridden.
   */
  rgb: string;
  light: string;
  dark: string;
  soft: string;
  glow: string;
  /** Secondary accent (pink/rose end of the signature brand gradient). */
  accent: string;
  /** RGB triplet for the accent — same `rgba(var(--brand-accent-rgb), X)` pattern. */
  accentRgb: string;
  /** Lighter variant of the accent (used in some gradients and badges). */
  accentLight: string;
}

export interface TextColorTokens {
  primary: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
  disabled: string;
}

export interface CtaColorTokens {
  primaryBg: string;
  primaryBgHover: string;
  primaryFg: string;
  secondaryBg: string;
  secondaryBgHover: string;
  secondaryFg: string;
  ghostBg: string;
  ghostBgHover: string;
}

export interface BorderColorTokens {
  subtle: string;
  strong: string;
  focus: string;
}

export interface StatusToneTokens {
  base: string;
  bg: string;
  fg: string;
}

export interface StatusColorTokens {
  success: StatusToneTokens;
  warning: StatusToneTokens;
  error: StatusToneTokens;
  info: StatusToneTokens;
}

export interface ColorTokens {
  surface: SurfaceColorTokens;
  brand: BrandColorTokens;
  text: TextColorTokens;
  cta: CtaColorTokens;
  border: BorderColorTokens;
  status: StatusColorTokens;
}

export interface BlurTokens {
  overlay: string;
  modal: string;
  dropdown: string;
  sheet: string;
}

export interface ShadowTokens {
  modal: string;
  dropdown: string;
  sheet: string;
  elev1: string;
  elev2: string;
  elev3: string;
  cardHover: string;
}

export interface RadiusTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  pill: string;
}

export interface MotionEasingTokens {
  out: string;
  inOut: string;
  spring: string;
}

export interface MotionDurationTokens {
  instant: string;
  fast: string;
  base: string;
  slow: string;
  page: string;
}

export interface MotionTokens {
  easing: MotionEasingTokens;
  duration: MotionDurationTokens;
  hoverDelay: string;
  hoverScale: string;
}

export interface LayoutTokens {
  topnavHeight: string;
  topnavHeightMobile: string;
  tabbarHeight: string;
  rowGutterMobile: string;
  rowGutterDesktop: string;
}

export interface ComponentSizeTokens {
  logoSm: string;
  logoMd: string;
  logoLg: string;
  logoXl: string;
}

export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  "3xl": string;
  "4xl": string;
  "5xl": string;
  "6xl": string;
}

export interface TypographyFontFamily {
  sans: string;
}

export interface TypographyFontSize {
  display1: string;
  display2: string;
  display3: string;
  heading1: string;
  heading2: string;
  heading3: string;
  body: string;
  bodyLg: string;
  caption: string;
  small: string;
  badge: string;
}

export interface TypographyTokens {
  fontFamily: TypographyFontFamily;
  fontSize: TypographyFontSize;
}

export interface ThemeTokens {
  color: ColorTokens;
  blur: BlurTokens;
  shadow: ShadowTokens;
  radius: RadiusTokens;
  motion: MotionTokens;
  layout: LayoutTokens;
  component: ComponentSizeTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly tokens: ThemeTokens;
}

export type PartialTheme = DeepPartial<Theme>;
export type PartialThemeTokens = DeepPartial<ThemeTokens>;

/**
 * Maps every leaf of `ThemeTokens` to a CSS variable name (without `var(--…)`
 * wrapper, just the `--name` identifier). Mirrors the token tree shape.
 */
export type CssVarNameMap<T> = {
  [K in keyof T]: T[K] extends string ? string : CssVarNameMap<T[K]>;
};
