/**
 * Flat inventory of every theme token exposed by `@tentacle-tv/theme`.
 * Powers the admin "all tokens" editor — each entry is renderable as a row
 * with a type-appropriate editor (color picker, dimension input, etc.).
 *
 * Total: 98 tokens (46 color + 4 blur + 7 shadow + 6 radius + 12 motion +
 * 5 layout + 4 component + 10 spacing + 11 typography).
 */

import { DEFAULT_THEME } from "@tentacle-tv/theme";

export type TokenCategory =
  | "color"
  | "blur"
  | "shadow"
  | "radius"
  | "motion"
  | "layout"
  | "component"
  | "spacing"
  | "typography";

export type TokenEditorType =
  | "color"
  | "rgba"
  | "rgb-triplet"
  | "dimension-px"
  | "dimension-rem"
  | "duration-ms"
  | "scale"
  | "cubic-bezier"
  | "multi-shadow"
  | "font-family";

export interface TokenDescriptor {
  category: TokenCategory;
  /** Dot path inside `ThemeTokens` (ex: `color.brand.base`). */
  path: string;
  /** Corresponding CSS variable name (`--brand`) — empty for TS-only tokens. */
  cssVar?: string;
  defaultValue: string;
  type: TokenEditorType;
  /** Short label for UI display. */
  label: string;
}

const t = DEFAULT_THEME.tokens;

export const TOKEN_CATALOG: readonly TokenDescriptor[] = [
  // ── COLOR : Surface ──
  { category: "color", path: "color.surface.s0", cssVar: "--surface-0", defaultValue: t.color.surface.s0, type: "color", label: "Surface 0 (page bg)" },
  { category: "color", path: "color.surface.s1", cssVar: "--surface-1", defaultValue: t.color.surface.s1, type: "color", label: "Surface 1 (cards)" },
  { category: "color", path: "color.surface.s2", cssVar: "--surface-2", defaultValue: t.color.surface.s2, type: "color", label: "Surface 2 (hover)" },
  { category: "color", path: "color.surface.s3", cssVar: "--surface-3", defaultValue: t.color.surface.s3, type: "color", label: "Surface 3 (elevated)" },
  { category: "color", path: "color.surface.overlay", cssVar: "--surface-overlay", defaultValue: t.color.surface.overlay, type: "rgba", label: "Surface overlay" },
  { category: "color", path: "color.surface.modal", cssVar: "--surface-modal", defaultValue: t.color.surface.modal, type: "rgba", label: "Surface modal" },
  { category: "color", path: "color.surface.dropdown", cssVar: "--surface-dropdown", defaultValue: t.color.surface.dropdown, type: "rgba", label: "Surface dropdown" },
  { category: "color", path: "color.surface.sheet", cssVar: "--surface-sheet", defaultValue: t.color.surface.sheet, type: "rgba", label: "Surface sheet" },
  { category: "color", path: "color.surface.toolbar", cssVar: "--surface-toolbar", defaultValue: t.color.surface.toolbar, type: "rgba", label: "Surface toolbar" },

  // ── COLOR : Brand ──
  { category: "color", path: "color.brand.base", cssVar: "--brand", defaultValue: t.color.brand.base, type: "color", label: "Brand (base)" },
  { category: "color", path: "color.brand.rgb", cssVar: "--brand-rgb", defaultValue: t.color.brand.rgb, type: "rgb-triplet", label: "Brand RGB triplet" },
  { category: "color", path: "color.brand.light", cssVar: "--brand-light", defaultValue: t.color.brand.light, type: "color", label: "Brand light" },
  { category: "color", path: "color.brand.dark", cssVar: "--brand-dark", defaultValue: t.color.brand.dark, type: "color", label: "Brand dark" },
  { category: "color", path: "color.brand.soft", cssVar: "--brand-soft", defaultValue: t.color.brand.soft, type: "rgba", label: "Brand soft (15%)" },
  { category: "color", path: "color.brand.glow", cssVar: "--brand-glow", defaultValue: t.color.brand.glow, type: "rgba", label: "Brand glow (40%)" },
  { category: "color", path: "color.brand.accent", cssVar: "--brand-accent", defaultValue: t.color.brand.accent, type: "color", label: "Brand accent (pink)" },
  { category: "color", path: "color.brand.accentRgb", cssVar: "--brand-accent-rgb", defaultValue: t.color.brand.accentRgb, type: "rgb-triplet", label: "Accent RGB triplet" },
  { category: "color", path: "color.brand.accentLight", cssVar: "--brand-accent-light", defaultValue: t.color.brand.accentLight, type: "color", label: "Accent light" },

  // ── COLOR : Text ──
  { category: "color", path: "color.text.primary", cssVar: "--text-primary", defaultValue: t.color.text.primary, type: "color", label: "Text primary" },
  { category: "color", path: "color.text.secondary", cssVar: "--text-secondary", defaultValue: t.color.text.secondary, type: "rgba", label: "Text secondary (78%)" },
  { category: "color", path: "color.text.tertiary", cssVar: "--text-tertiary", defaultValue: t.color.text.tertiary, type: "rgba", label: "Text tertiary (55%)" },
  { category: "color", path: "color.text.quaternary", cssVar: "--text-quaternary", defaultValue: t.color.text.quaternary, type: "rgba", label: "Text quaternary (34%)" },
  { category: "color", path: "color.text.disabled", cssVar: "--text-disabled", defaultValue: t.color.text.disabled, type: "rgba", label: "Text disabled (22%)" },

  // ── COLOR : CTA ──
  { category: "color", path: "color.cta.primaryBg", cssVar: "--cta-primary-bg", defaultValue: t.color.cta.primaryBg, type: "color", label: "CTA primary bg" },
  { category: "color", path: "color.cta.primaryBgHover", cssVar: "--cta-primary-bg-hover", defaultValue: t.color.cta.primaryBgHover, type: "rgba", label: "CTA primary hover" },
  { category: "color", path: "color.cta.primaryFg", cssVar: "--cta-primary-fg", defaultValue: t.color.cta.primaryFg, type: "color", label: "CTA primary fg" },
  { category: "color", path: "color.cta.secondaryBg", cssVar: "--cta-secondary-bg", defaultValue: t.color.cta.secondaryBg, type: "rgba", label: "CTA secondary bg" },
  { category: "color", path: "color.cta.secondaryBgHover", cssVar: "--cta-secondary-bg-hover", defaultValue: t.color.cta.secondaryBgHover, type: "rgba", label: "CTA secondary hover" },
  { category: "color", path: "color.cta.secondaryFg", cssVar: "--cta-secondary-fg", defaultValue: t.color.cta.secondaryFg, type: "color", label: "CTA secondary fg" },
  { category: "color", path: "color.cta.ghostBg", cssVar: "--cta-ghost-bg", defaultValue: t.color.cta.ghostBg, type: "rgba", label: "CTA ghost bg" },
  { category: "color", path: "color.cta.ghostBgHover", cssVar: "--cta-ghost-bg-hover", defaultValue: t.color.cta.ghostBgHover, type: "rgba", label: "CTA ghost hover" },

  // ── COLOR : Border ──
  { category: "color", path: "color.border.subtle", cssVar: "--border-subtle", defaultValue: t.color.border.subtle, type: "rgba", label: "Border subtle" },
  { category: "color", path: "color.border.strong", cssVar: "--border-strong", defaultValue: t.color.border.strong, type: "rgba", label: "Border strong" },
  { category: "color", path: "color.border.focus", cssVar: "--border-focus", defaultValue: t.color.border.focus, type: "rgba", label: "Border focus" },

  // ── COLOR : Status ──
  { category: "color", path: "color.status.success.base", cssVar: "--status-success", defaultValue: t.color.status.success.base, type: "color", label: "Success base" },
  { category: "color", path: "color.status.success.bg", cssVar: "--status-success-bg", defaultValue: t.color.status.success.bg, type: "rgba", label: "Success bg" },
  { category: "color", path: "color.status.success.fg", cssVar: "--status-success-fg", defaultValue: t.color.status.success.fg, type: "color", label: "Success fg" },
  { category: "color", path: "color.status.warning.base", cssVar: "--status-warning", defaultValue: t.color.status.warning.base, type: "color", label: "Warning base" },
  { category: "color", path: "color.status.warning.bg", cssVar: "--status-warning-bg", defaultValue: t.color.status.warning.bg, type: "rgba", label: "Warning bg" },
  { category: "color", path: "color.status.warning.fg", cssVar: "--status-warning-fg", defaultValue: t.color.status.warning.fg, type: "color", label: "Warning fg" },
  { category: "color", path: "color.status.error.base", cssVar: "--status-error", defaultValue: t.color.status.error.base, type: "color", label: "Error base" },
  { category: "color", path: "color.status.error.bg", cssVar: "--status-error-bg", defaultValue: t.color.status.error.bg, type: "rgba", label: "Error bg" },
  { category: "color", path: "color.status.error.fg", cssVar: "--status-error-fg", defaultValue: t.color.status.error.fg, type: "color", label: "Error fg" },
  { category: "color", path: "color.status.info.base", cssVar: "--status-info", defaultValue: t.color.status.info.base, type: "color", label: "Info base" },
  { category: "color", path: "color.status.info.bg", cssVar: "--status-info-bg", defaultValue: t.color.status.info.bg, type: "rgba", label: "Info bg" },
  { category: "color", path: "color.status.info.fg", cssVar: "--status-info-fg", defaultValue: t.color.status.info.fg, type: "color", label: "Info fg" },

  // ── BLUR ──
  { category: "blur", path: "blur.overlay", cssVar: "--blur-overlay", defaultValue: t.blur.overlay, type: "dimension-px", label: "Blur overlay" },
  { category: "blur", path: "blur.modal", cssVar: "--blur-modal", defaultValue: t.blur.modal, type: "dimension-px", label: "Blur modal" },
  { category: "blur", path: "blur.dropdown", cssVar: "--blur-dropdown", defaultValue: t.blur.dropdown, type: "dimension-px", label: "Blur dropdown" },
  { category: "blur", path: "blur.sheet", cssVar: "--blur-sheet", defaultValue: t.blur.sheet, type: "dimension-px", label: "Blur sheet" },

  // ── SHADOW ──
  { category: "shadow", path: "shadow.modal", cssVar: "--shadow-modal", defaultValue: t.shadow.modal, type: "multi-shadow", label: "Shadow modal" },
  { category: "shadow", path: "shadow.dropdown", cssVar: "--shadow-dropdown", defaultValue: t.shadow.dropdown, type: "multi-shadow", label: "Shadow dropdown" },
  { category: "shadow", path: "shadow.sheet", cssVar: "--shadow-sheet", defaultValue: t.shadow.sheet, type: "multi-shadow", label: "Shadow sheet" },
  { category: "shadow", path: "shadow.elev1", cssVar: "--elev-1", defaultValue: t.shadow.elev1, type: "multi-shadow", label: "Elevation 1" },
  { category: "shadow", path: "shadow.elev2", cssVar: "--elev-2", defaultValue: t.shadow.elev2, type: "multi-shadow", label: "Elevation 2" },
  { category: "shadow", path: "shadow.elev3", cssVar: "--elev-3", defaultValue: t.shadow.elev3, type: "multi-shadow", label: "Elevation 3" },
  { category: "shadow", path: "shadow.cardHover", cssVar: "--elev-card-hover", defaultValue: t.shadow.cardHover, type: "multi-shadow", label: "Card hover" },

  // ── RADIUS ──
  { category: "radius", path: "radius.xs", cssVar: "--radius-xs", defaultValue: t.radius.xs, type: "dimension-px", label: "Radius xs" },
  { category: "radius", path: "radius.sm", cssVar: "--radius-sm", defaultValue: t.radius.sm, type: "dimension-px", label: "Radius sm" },
  { category: "radius", path: "radius.md", cssVar: "--radius-md", defaultValue: t.radius.md, type: "dimension-px", label: "Radius md" },
  { category: "radius", path: "radius.lg", cssVar: "--radius-lg", defaultValue: t.radius.lg, type: "dimension-px", label: "Radius lg" },
  { category: "radius", path: "radius.xl", cssVar: "--radius-xl", defaultValue: t.radius.xl, type: "dimension-px", label: "Radius xl" },
  { category: "radius", path: "radius.pill", cssVar: "--radius-pill", defaultValue: t.radius.pill, type: "dimension-px", label: "Radius pill" },

  // ── MOTION : Easing ──
  { category: "motion", path: "motion.easing.out", cssVar: "--ease-out", defaultValue: t.motion.easing.out, type: "cubic-bezier", label: "Ease out" },
  { category: "motion", path: "motion.easing.inOut", cssVar: "--ease-in-out", defaultValue: t.motion.easing.inOut, type: "cubic-bezier", label: "Ease in-out" },
  { category: "motion", path: "motion.easing.spring", cssVar: "--ease-spring", defaultValue: t.motion.easing.spring, type: "cubic-bezier", label: "Ease spring" },

  // ── MOTION : Duration ──
  { category: "motion", path: "motion.duration.instant", cssVar: "--duration-instant", defaultValue: t.motion.duration.instant, type: "duration-ms", label: "Duration instant" },
  { category: "motion", path: "motion.duration.fast", cssVar: "--duration-fast", defaultValue: t.motion.duration.fast, type: "duration-ms", label: "Duration fast" },
  { category: "motion", path: "motion.duration.base", cssVar: "--duration-base", defaultValue: t.motion.duration.base, type: "duration-ms", label: "Duration base" },
  { category: "motion", path: "motion.duration.slow", cssVar: "--duration-slow", defaultValue: t.motion.duration.slow, type: "duration-ms", label: "Duration slow" },
  { category: "motion", path: "motion.duration.page", cssVar: "--duration-page", defaultValue: t.motion.duration.page, type: "duration-ms", label: "Duration page" },

  // ── MOTION : Hover ──
  { category: "motion", path: "motion.hoverDelay", cssVar: "--hover-delay", defaultValue: t.motion.hoverDelay, type: "duration-ms", label: "Hover delay" },
  { category: "motion", path: "motion.hoverScale", cssVar: "--hover-scale", defaultValue: t.motion.hoverScale, type: "scale", label: "Hover scale" },

  // ── LAYOUT ──
  { category: "layout", path: "layout.topnavHeight", cssVar: "--topnav-height", defaultValue: t.layout.topnavHeight, type: "dimension-px", label: "Topnav height (desktop)" },
  { category: "layout", path: "layout.topnavHeightMobile", cssVar: "--topnav-height-mobile", defaultValue: t.layout.topnavHeightMobile, type: "dimension-px", label: "Topnav height (mobile)" },
  { category: "layout", path: "layout.tabbarHeight", cssVar: "--tabbar-height", defaultValue: t.layout.tabbarHeight, type: "dimension-px", label: "Tabbar height" },
  { category: "layout", path: "layout.rowGutterMobile", cssVar: "--row-gutter-mobile", defaultValue: t.layout.rowGutterMobile, type: "dimension-px", label: "Row gutter (mobile)" },
  { category: "layout", path: "layout.rowGutterDesktop", cssVar: "--row-gutter-desktop", defaultValue: t.layout.rowGutterDesktop, type: "dimension-px", label: "Row gutter (desktop)" },

  // ── COMPONENT : Logo ──
  { category: "component", path: "component.logoSm", cssVar: "--logo-size-sm", defaultValue: t.component.logoSm, type: "dimension-px", label: "Logo sm" },
  { category: "component", path: "component.logoMd", cssVar: "--logo-size-md", defaultValue: t.component.logoMd, type: "dimension-px", label: "Logo md" },
  { category: "component", path: "component.logoLg", cssVar: "--logo-size-lg", defaultValue: t.component.logoLg, type: "dimension-px", label: "Logo lg" },
  { category: "component", path: "component.logoXl", cssVar: "--logo-size-xl", defaultValue: t.component.logoXl, type: "dimension-px", label: "Logo xl" },

  // ── SPACING (TS-only, no CSS var) ──
  { category: "spacing", path: "spacing.xs", defaultValue: t.spacing.xs, type: "dimension-px", label: "Spacing xs" },
  { category: "spacing", path: "spacing.sm", defaultValue: t.spacing.sm, type: "dimension-px", label: "Spacing sm" },
  { category: "spacing", path: "spacing.md", defaultValue: t.spacing.md, type: "dimension-px", label: "Spacing md" },
  { category: "spacing", path: "spacing.lg", defaultValue: t.spacing.lg, type: "dimension-px", label: "Spacing lg" },
  { category: "spacing", path: "spacing.xl", defaultValue: t.spacing.xl, type: "dimension-px", label: "Spacing xl" },
  { category: "spacing", path: "spacing.2xl", defaultValue: t.spacing["2xl"], type: "dimension-px", label: "Spacing 2xl" },
  { category: "spacing", path: "spacing.3xl", defaultValue: t.spacing["3xl"], type: "dimension-px", label: "Spacing 3xl" },
  { category: "spacing", path: "spacing.4xl", defaultValue: t.spacing["4xl"], type: "dimension-px", label: "Spacing 4xl" },
  { category: "spacing", path: "spacing.5xl", defaultValue: t.spacing["5xl"], type: "dimension-px", label: "Spacing 5xl" },
  { category: "spacing", path: "spacing.6xl", defaultValue: t.spacing["6xl"], type: "dimension-px", label: "Spacing 6xl" },

  // ── TYPOGRAPHY (TS-only) ──
  { category: "typography", path: "typography.fontFamily.sans", defaultValue: t.typography.fontFamily.sans, type: "font-family", label: "Font sans" },
  { category: "typography", path: "typography.fontSize.display1", defaultValue: t.typography.fontSize.display1, type: "dimension-rem", label: "Display 1" },
  { category: "typography", path: "typography.fontSize.display2", defaultValue: t.typography.fontSize.display2, type: "dimension-rem", label: "Display 2" },
  { category: "typography", path: "typography.fontSize.display3", defaultValue: t.typography.fontSize.display3, type: "dimension-rem", label: "Display 3" },
  { category: "typography", path: "typography.fontSize.heading1", defaultValue: t.typography.fontSize.heading1, type: "dimension-rem", label: "Heading 1" },
  { category: "typography", path: "typography.fontSize.heading2", defaultValue: t.typography.fontSize.heading2, type: "dimension-rem", label: "Heading 2" },
  { category: "typography", path: "typography.fontSize.heading3", defaultValue: t.typography.fontSize.heading3, type: "dimension-rem", label: "Heading 3" },
  { category: "typography", path: "typography.fontSize.body", defaultValue: t.typography.fontSize.body, type: "dimension-px", label: "Body" },
  { category: "typography", path: "typography.fontSize.bodyLg", defaultValue: t.typography.fontSize.bodyLg, type: "dimension-px", label: "Body large" },
  { category: "typography", path: "typography.fontSize.caption", defaultValue: t.typography.fontSize.caption, type: "dimension-px", label: "Caption" },
  { category: "typography", path: "typography.fontSize.small", defaultValue: t.typography.fontSize.small, type: "dimension-px", label: "Small" },
  { category: "typography", path: "typography.fontSize.badge", defaultValue: t.typography.fontSize.badge, type: "dimension-px", label: "Badge" },
];

export const TOKEN_CATEGORIES: readonly TokenCategory[] = [
  "color",
  "blur",
  "shadow",
  "radius",
  "motion",
  "layout",
  "component",
  "spacing",
  "typography",
];
