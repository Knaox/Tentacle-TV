/**
 * Tokens de thème injectés dans la WebView plugin.
 *
 * Deux niveaux :
 *  1. `PluginThemeVars` / `buildPluginThemeVars` — palette LEGACY (13 champs :
 *     bg/surface/accent/text… + alias `tentacle-bg/surface/accent`). Conservée
 *     telle quelle pour le body, les états loading/error et les composants
 *     historiques.
 *  2. `buildPluginTokenCss` + `PLUGIN_TENTACLE_COLORS` + `PLUGIN_TW_EXTEND` —
 *     le VOCABULAIRE SÉMANTIQUE COMPLET (~60 tokens : surface-0..3, text-*,
 *     brand*, cta-*, border-*, status-*, fill-*, surface-modal/dropdown/…,
 *     blur/shadow/elev/radius/ease/duration). Dérivé du thème mobile ACTIF, donc
 *     valeurs CLAIRES en thème clair. C'est ce qui manquait : sans lui, le
 *     plugin retombait sur son fallback SOMBRE figé (Seer/host-theme.ts) même en
 *     clair. Avec, `ensureHostTheme()` du plugin détecte --surface-1 → no-op.
 *
 * NOTE : SEUL fichier (avec pluginHtmlTemplate) autorisé à contenir des
 * littéraux couleur hors src/theme (sous-palette WebView, exclue du re-scan).
 * En SOMBRE, les valeurs mappent 1:1 le fallback historique → rendu inchangé.
 */

import type { AppTheme, ResolvedScheme } from "../theme/palette.types";
import { hexToRgb, withAlpha } from "../theme/colorUtils";

export interface PluginThemeVars {
  scheme: ResolvedScheme;
  bg: string;
  surface: string;
  border: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  accentMuted: string;
  text: string;
  textSecondary: string;
  error: string;
  accentGlowSoft: string;
  accentGlowStrong: string;
}

/**
 * Palette LEGACY de la WebView. En sombre, on garde les teintes bleutées
 * historiques (#080812/#12121a) ; en clair on dérive des tokens app.
 */
export function buildPluginThemeVars(t: AppTheme): PluginThemeVars {
  const { colors } = t;
  return {
    scheme: t.scheme,
    bg: t.isDark ? "#080812" : colors.surface.s0,
    surface: t.isDark ? "#12121a" : colors.surface.s1,
    border: t.isDark ? "#1e1e2e" : colors.border.subtle,
    accent: colors.brand.violet,
    accentDark: colors.brand.dark,
    accentLight: colors.brand.light,
    accentMuted: t.isDark ? "#C4B5FD" : colors.brand.light,
    text: colors.text.primary,
    textSecondary: t.isDark ? "#9ca3af" : colors.text.tertiary,
    error: colors.status.error,
    accentGlowSoft: withAlpha(colors.brand.violet, 0.3, colors.brand.glow),
    accentGlowStrong: withAlpha(colors.brand.violet, 0.5, colors.brand.glow),
  };
}

/** rgb « r, g, b » d'un hex de marque (pour --brand-rgb). */
function rgbTriplet(hex: string, fallback: string): string {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : fallback;
}

/**
 * Le `:root{…}` sémantique COMPLET, dérivé du thème actif. Les valeurs SOMBRES
 * reproduisent le fallback historique du plugin (rendu dark inchangé) ; les
 * valeurs CLAIRES viennent de la palette light (surfaces blanches, texte foncé,
 * CTA violet, statuts assombris, ombres douces).
 */
export function buildPluginTokenCss(t: AppTheme): string {
  const { colors: c, isDark } = t;
  const brandRgb = rgbTriplet(c.brand.violet, isDark ? "139, 92, 246" : "124, 58, 237");
  const sp = c.statusPairs;
  return `:root{
--surface-0:${c.surface.s0};--surface-1:${c.surface.s1};--surface-2:${c.surface.s2};--surface-3:${c.surface.s3};
--surface-overlay:${c.surface.overlay};
--surface-modal:${isDark ? "rgba(15,15,21,0.96)" : "rgba(255,255,255,0.97)"};
--surface-dropdown:${isDark ? "rgba(20,20,26,0.95)" : "rgba(255,255,255,0.96)"};
--surface-sheet:${isDark ? "rgba(15,15,21,0.96)" : "rgba(255,255,255,0.97)"};
--surface-toolbar:${isDark ? "rgba(20,20,26,0.92)" : "rgba(248,248,252,0.94)"};
--text-primary:${c.text.primary};--text-secondary:${c.text.secondary};--text-tertiary:${c.text.tertiary};
--text-quaternary:${c.text.quaternary};--text-disabled:${c.text.disabled};
--brand:${c.brand.violet};--brand-rgb:${brandRgb};--brand-light:${c.brand.light};--brand-dark:${c.brand.dark};
--brand-soft:${c.brand.soft};--brand-glow:${c.brand.glow};
--brand-accent:${c.brand.accent};--brand-accent-rgb:${rgbTriplet(c.brand.accent, "236, 72, 153")};--brand-accent-light:${c.brand.accentLight};
--cta-primary-bg:${c.cta.primaryBg};--cta-primary-bg-hover:${c.cta.primaryBgHover};--cta-primary-fg:${c.cta.primaryFg};
--cta-secondary-bg:${c.cta.secondaryBg};--cta-secondary-bg-hover:${c.cta.secondaryBgHover};--cta-secondary-fg:${c.cta.secondaryFg};
--cta-ghost-bg:${c.cta.ghostBg};--cta-ghost-bg-hover:${c.cta.ghostBgHover};
--border-subtle:${c.border.subtle};--border-strong:${c.border.strong};--border-focus:${c.border.focus};
--status-success:${c.status.success};--status-warning:${c.status.warning};--status-error:${c.status.error};--status-info:${c.status.info};
--status-success-bg:${sp.success.bg};--status-success-fg:${sp.success.fg};
--status-warning-bg:${sp.warning.bg};--status-warning-fg:${sp.warning.fg};
--status-error-bg:${sp.error.bg};--status-error-fg:${sp.error.fg};
--status-info-bg:${sp.info.bg};--status-info-fg:${sp.info.fg};
--fill-faint:${c.fill.faint};--fill-subtle:${c.fill.subtle};--fill-soft:${c.fill.soft};--fill-medium:${c.fill.medium};--fill-strong:${c.fill.strong};
--blur-overlay:24px;--blur-modal:20px;--blur-dropdown:12px;--blur-sheet:16px;
--shadow-modal:${isDark ? "0 25px 70px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)" : "0 20px 60px rgba(11,11,16,0.18),0 0 0 1px rgba(0,0,0,0.05)"};
--shadow-dropdown:${isDark ? "0 12px 36px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06)" : "0 12px 36px rgba(11,11,16,0.14),0 0 0 1px rgba(0,0,0,0.05)"};
--shadow-sheet:${isDark ? "0 -8px 32px rgba(0,0,0,0.5)" : "0 -8px 32px rgba(11,11,16,0.12)"};
--elev-1:${isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(11,11,16,0.08)"};
--elev-2:${isDark ? "0 8px 24px rgba(0,0,0,0.55)" : "0 8px 24px rgba(11,11,16,0.1)"};
--elev-3:${isDark ? "0 16px 48px rgba(0,0,0,0.7)" : "0 16px 48px rgba(11,11,16,0.14)"};
--radius-xs:4px;--radius-sm:6px;--radius-md:8px;--radius-lg:12px;--radius-xl:16px;--radius-pill:9999px;
--ease-out:cubic-bezier(0.22,1,0.36,1);--ease-in-out:cubic-bezier(0.65,0,0.35,1);--ease-spring:cubic-bezier(0.34,1.56,0.64,1);
--duration-instant:80ms;--duration-fast:150ms;--duration-base:240ms;--duration-slow:400ms;
color-scheme:${t.scheme};
}`;
}

/** Mapping nom sémantique Tailwind → var() (constant, comme Seer/host-theme.ts). */
export const PLUGIN_TENTACLE_COLORS: Record<string, string> = {
  "surface-0": "var(--surface-0)", "surface-1": "var(--surface-1)",
  "surface-2": "var(--surface-2)", "surface-3": "var(--surface-3)",
  "surface-modal": "var(--surface-modal)", "surface-dropdown": "var(--surface-dropdown)",
  "surface-toolbar": "var(--surface-toolbar)",
  brand: "var(--brand)", "brand-light": "var(--brand-light)",
  "brand-dark": "var(--brand-dark)", "brand-accent": "var(--brand-accent)",
  "brand-soft": "var(--brand-soft)",
  "text-primary": "var(--text-primary)", "text-secondary": "var(--text-secondary)",
  "text-tertiary": "var(--text-tertiary)", "text-quaternary": "var(--text-quaternary)",
  "text-disabled": "var(--text-disabled)",
  "cta-primary": "var(--cta-primary-bg)", "cta-primary-fg": "var(--cta-primary-fg)",
  "cta-secondary": "var(--cta-secondary-bg)", "cta-secondary-fg": "var(--cta-secondary-fg)",
  "cta-ghost": "var(--cta-ghost-bg)",
  "border-subtle": "var(--border-subtle)", "border-strong": "var(--border-strong)",
  "border-focus": "var(--border-focus)",
  "fill-faint": "var(--fill-faint)", "fill-subtle": "var(--fill-subtle)",
  "fill-soft": "var(--fill-soft)", "fill-medium": "var(--fill-medium)", "fill-strong": "var(--fill-strong)",
  "status-success": "var(--status-success)", "status-success-bg": "var(--status-success-bg)",
  "status-success-fg": "var(--status-success-fg)",
  "status-warning": "var(--status-warning)", "status-warning-bg": "var(--status-warning-bg)",
  "status-warning-fg": "var(--status-warning-fg)",
  "status-error": "var(--status-error)", "status-error-bg": "var(--status-error-bg)",
  "status-error-fg": "var(--status-error-fg)",
  "status-info": "var(--status-info)", "status-info-bg": "var(--status-info-bg)",
  "status-info-fg": "var(--status-info-fg)",
};

/** Extends Tailwind non-couleur (radius/shadow/blur/timing) → var(). */
export const PLUGIN_TW_EXTEND = {
  borderRadius: {
    "tentacle-xs": "var(--radius-xs)", "tentacle-sm": "var(--radius-sm)",
    "tentacle-md": "var(--radius-md)", "tentacle-lg": "var(--radius-lg)",
    "tentacle-xl": "var(--radius-xl)", "tentacle-pill": "var(--radius-pill)",
  },
  boxShadow: {
    "tentacle-elev-1": "var(--elev-1)", "tentacle-elev-2": "var(--elev-2)",
    "tentacle-elev-3": "var(--elev-3)", "tentacle-modal": "var(--shadow-modal)",
    "tentacle-dropdown": "var(--shadow-dropdown)", "tentacle-sheet": "var(--shadow-sheet)",
  },
  backdropBlur: {
    "tentacle-overlay": "var(--blur-overlay)", "tentacle-modal": "var(--blur-modal)",
    "tentacle-dropdown": "var(--blur-dropdown)", "tentacle-sheet": "var(--blur-sheet)",
  },
  transitionTimingFunction: {
    "tentacle-out": "var(--ease-out)", "tentacle-in-out": "var(--ease-in-out)",
    "tentacle-spring": "var(--ease-spring)",
  },
  transitionDuration: {
    "tentacle-instant": "var(--duration-instant)", "tentacle-fast": "var(--duration-fast)",
    "tentacle-base": "var(--duration-base)", "tentacle-slow": "var(--duration-slow)",
  },
  animation: {
    shimmer: "shimmer 1.5s ease infinite",
    "fade-slide-up": "fadeSlideUp 0.5s ease both",
    "fade-slide-down": "fadeSlideDown 0.3s ease both",
    "scale-in": "scaleIn 0.2s ease both",
    "slide-in-right": "slideInRight 0.25s ease both",
    "pulse-glow": "pulseGlow 2s ease infinite",
    breathe: "breathe 2s ease infinite",
  },
} as const;
