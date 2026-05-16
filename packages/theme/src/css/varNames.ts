import type {
  BlurTokens,
  ColorTokens,
  ComponentSizeTokens,
  CssVarNameMap,
  LayoutTokens,
  MotionTokens,
  RadiusTokens,
  ShadowTokens,
} from "../types";

/**
 * Subset of the theme tokens emitted as CSS custom properties. Spacing and
 * typography are intentionally excluded for the lossless Phase 1 migration:
 * web currently consumes Tailwind's default spacing scale and Tailwind-defined
 * font sizes, neither of which use `var(--…)` lookups. Adding CSS variables
 * for those would not change rendering but would broaden the API surface
 * beyond the existing source of authority (`apps/web/src/theme/tokens.css`).
 */
export interface CssEmittedTokens {
  color: ColorTokens;
  blur: BlurTokens;
  shadow: ShadowTokens;
  radius: RadiusTokens;
  motion: MotionTokens;
  layout: LayoutTokens;
  component: ComponentSizeTokens;
}

/**
 * Token-path → CSS variable name. Every name here is byte-for-byte identical
 * to a declaration in `apps/web/src/theme/tokens.css` so that swapping the
 * generator in for the static file is a no-op for existing consumers
 * (`var(--brand)`, `bg-[var(--surface-0)]`, etc.).
 */
export const CSS_VAR_NAMES: CssVarNameMap<CssEmittedTokens> = {
  color: {
    surface: {
      s0: "--surface-0",
      s1: "--surface-1",
      s2: "--surface-2",
      s3: "--surface-3",
      overlay: "--surface-overlay",
      modal: "--surface-modal",
      dropdown: "--surface-dropdown",
      sheet: "--surface-sheet",
      toolbar: "--surface-toolbar",
    },
    brand: {
      base: "--brand",
      rgb: "--brand-rgb",
      light: "--brand-light",
      dark: "--brand-dark",
      soft: "--brand-soft",
      glow: "--brand-glow",
      accent: "--brand-accent",
      accentRgb: "--brand-accent-rgb",
      accentLight: "--brand-accent-light",
    },
    text: {
      primary: "--text-primary",
      secondary: "--text-secondary",
      tertiary: "--text-tertiary",
      quaternary: "--text-quaternary",
      disabled: "--text-disabled",
    },
    cta: {
      primaryBg: "--cta-primary-bg",
      primaryBgHover: "--cta-primary-bg-hover",
      primaryFg: "--cta-primary-fg",
      secondaryBg: "--cta-secondary-bg",
      secondaryBgHover: "--cta-secondary-bg-hover",
      secondaryFg: "--cta-secondary-fg",
      ghostBg: "--cta-ghost-bg",
      ghostBgHover: "--cta-ghost-bg-hover",
    },
    border: {
      subtle: "--border-subtle",
      strong: "--border-strong",
      focus: "--border-focus",
    },
    status: {
      success: {
        base: "--status-success",
        bg: "--status-success-bg",
        fg: "--status-success-fg",
      },
      warning: {
        base: "--status-warning",
        bg: "--status-warning-bg",
        fg: "--status-warning-fg",
      },
      error: {
        base: "--status-error",
        bg: "--status-error-bg",
        fg: "--status-error-fg",
      },
      info: {
        base: "--status-info",
        bg: "--status-info-bg",
        fg: "--status-info-fg",
      },
    },
  },
  blur: {
    overlay: "--blur-overlay",
    modal: "--blur-modal",
    dropdown: "--blur-dropdown",
    sheet: "--blur-sheet",
  },
  shadow: {
    modal: "--shadow-modal",
    dropdown: "--shadow-dropdown",
    sheet: "--shadow-sheet",
    elev1: "--elev-1",
    elev2: "--elev-2",
    elev3: "--elev-3",
    cardHover: "--elev-card-hover",
  },
  radius: {
    xs: "--radius-xs",
    sm: "--radius-sm",
    md: "--radius-md",
    lg: "--radius-lg",
    xl: "--radius-xl",
    pill: "--radius-pill",
  },
  motion: {
    easing: {
      out: "--ease-out",
      inOut: "--ease-in-out",
      spring: "--ease-spring",
    },
    duration: {
      instant: "--duration-instant",
      fast: "--duration-fast",
      base: "--duration-base",
      slow: "--duration-slow",
      page: "--duration-page",
    },
    hoverDelay: "--hover-delay",
    hoverScale: "--hover-scale",
  },
  layout: {
    topnavHeight: "--topnav-height",
    topnavHeightMobile: "--topnav-height-mobile",
    tabbarHeight: "--tabbar-height",
    rowGutterMobile: "--row-gutter-mobile",
    rowGutterDesktop: "--row-gutter-desktop",
  },
  component: {
    logoSm: "--logo-size-sm",
    logoMd: "--logo-size-md",
    logoLg: "--logo-size-lg",
    logoXl: "--logo-size-xl",
  },
};

/** Helper to wrap a CSS variable name in `var(...)`. */
export const cssVar = (name: string): string => `var(${name})`;
