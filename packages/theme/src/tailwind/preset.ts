import type { Config } from "tailwindcss";
import { CSS_VAR_NAMES, cssVar } from "../css/varNames";

/**
 * Tailwind preset that mirrors the token-driven entries of
 * `apps/web/tailwind.config.ts`. Existing classes (`bg-surface-0`, `text-brand`,
 * `bg-tentacle-bg`, `text-display-1`, …) keep resolving to the same CSS
 * variables as before — this preset is a refactor, not a redesign.
 *
 * Consumers wire it via:
 *   import { tentacleTailwindPreset } from "@tentacle-tv/theme/tailwind";
 *   export default { presets: [tentacleTailwindPreset], content: [...] } satisfies Config;
 *
 * App-specific concerns (content globs, plugins, app-only animations/keyframes,
 * extra screens, …) stay in the consuming app config.
 */
export const tentacleTailwindPreset: Partial<Config> = {
  theme: {
    extend: {
      screens: {
        xs: "360px",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        surface: {
          0: cssVar(CSS_VAR_NAMES.color.surface.s0),
          1: cssVar(CSS_VAR_NAMES.color.surface.s1),
          2: cssVar(CSS_VAR_NAMES.color.surface.s2),
          3: cssVar(CSS_VAR_NAMES.color.surface.s3),
          // Paliers de chrome flottant. Ils existaient dans tokens.css mais pas
          // en classe, ce qui obligeait à écrire `bg-[var(--surface-dropdown)]`.
          modal: cssVar(CSS_VAR_NAMES.color.surface.modal),
          dropdown: cssVar(CSS_VAR_NAMES.color.surface.dropdown),
          sheet: cssVar(CSS_VAR_NAMES.color.surface.sheet),
          toolbar: cssVar(CSS_VAR_NAMES.color.surface.toolbar),
          "0-tint": cssVar(CSS_VAR_NAMES.color.surface.s0Tint),
        },
        brand: {
          DEFAULT: cssVar(CSS_VAR_NAMES.color.brand.base),
          light: cssVar(CSS_VAR_NAMES.color.brand.light),
          dark: cssVar(CSS_VAR_NAMES.color.brand.dark),
        },
        tentacle: {
          bg: cssVar(CSS_VAR_NAMES.color.surface.s0),
          surface: cssVar(CSS_VAR_NAMES.color.surface.s1),
          border: cssVar(CSS_VAR_NAMES.color.border.subtle),
          accent: cssVar(CSS_VAR_NAMES.color.brand.base),
          "accent-dark": cssVar(CSS_VAR_NAMES.color.brand.dark),
          "accent-light": cssVar(CSS_VAR_NAMES.color.brand.light),
          "accent-muted": cssVar(CSS_VAR_NAMES.color.brand.light),
        },
        /**
         * Statuts. Les paires `bg`/`fg` sont exposées en plus de la base :
         * les badges et toasts les utilisent partout, et `text-red-400` &co.
         * correspondent exactement aux `fg` — sans ces clés, ces cas n'avaient
         * pas de cible et restaient sur la palette Tailwind par défaut.
         */
        status: {
          success: {
            DEFAULT: cssVar(CSS_VAR_NAMES.color.status.success.base),
            bg: cssVar(CSS_VAR_NAMES.color.status.success.bg),
            fg: cssVar(CSS_VAR_NAMES.color.status.success.fg),
          },
          warning: {
            DEFAULT: cssVar(CSS_VAR_NAMES.color.status.warning.base),
            bg: cssVar(CSS_VAR_NAMES.color.status.warning.bg),
            fg: cssVar(CSS_VAR_NAMES.color.status.warning.fg),
          },
          error: {
            DEFAULT: cssVar(CSS_VAR_NAMES.color.status.error.base),
            bg: cssVar(CSS_VAR_NAMES.color.status.error.bg),
            fg: cssVar(CSS_VAR_NAMES.color.status.error.fg),
          },
          info: {
            DEFAULT: cssVar(CSS_VAR_NAMES.color.status.info.base),
            bg: cssVar(CSS_VAR_NAMES.color.status.info.bg),
            fg: cssVar(CSS_VAR_NAMES.color.status.info.fg),
          },
        },

        // ── Familles ajoutées pour la migration des couleurs en dur ────────
        // Sans elles il n'existait AUCUNE classe tokenisée équivalente à
        // `bg-white/5` ou `text-white/40` — d'où le repli massif du code sur
        // la palette Tailwind par défaut, qui casse en thème clair.

        /** Remplissages neutres translucides — remplace `bg-white/{3,5,8,12,28}`. */
        fill: {
          faint: cssVar(CSS_VAR_NAMES.color.fill.faint),
          subtle: cssVar(CSS_VAR_NAMES.color.fill.subtle),
          soft: cssVar(CSS_VAR_NAMES.color.fill.soft),
          medium: cssVar(CSS_VAR_NAMES.color.fill.medium),
          strong: cssVar(CSS_VAR_NAMES.color.fill.strong),
          shimmer: cssVar(CSS_VAR_NAMES.color.fill.shimmer),
        },

        /**
         * Couleur de texte — remplace les 15 paliers `text-white/*`.
         * Nommé `content` et non `text` : Tailwind génère déjà les classes
         * `text-*` pour la couleur, un token `text` produirait
         * `text-text-primary`. `text-content-secondary` se lit correctement.
         */
        content: {
          primary: cssVar(CSS_VAR_NAMES.color.text.primary),
          secondary: cssVar(CSS_VAR_NAMES.color.text.secondary),
          tertiary: cssVar(CSS_VAR_NAMES.color.text.tertiary),
          quaternary: cssVar(CSS_VAR_NAMES.color.text.quaternary),
          disabled: cssVar(CSS_VAR_NAMES.color.text.disabled),
        },

        /** Bordures — remplace `border-white/{5,10,16,20}`. */
        line: {
          subtle: cssVar(CSS_VAR_NAMES.color.border.subtle),
          strong: cssVar(CSS_VAR_NAMES.color.border.strong),
          focus: cssVar(CSS_VAR_NAMES.color.border.focus),
        },

        /** Surfaces verre (GlassSurface). */
        glass: {
          tint: cssVar(CSS_VAR_NAMES.color.glass.tint),
          "tint-strong": cssVar(CSS_VAR_NAMES.color.glass.tintStrong),
          panel: cssVar(CSS_VAR_NAMES.color.glass.panel),
          backdrop: cssVar(CSS_VAR_NAMES.color.glass.backdrop),
        },

        /** Texte posé sur une affiche — identique dans les deux schémas. */
        "on-media": {
          primary: cssVar(CSS_VAR_NAMES.color.onMedia.primary),
          secondary: cssVar(CSS_VAR_NAMES.color.onMedia.secondary),
        },

        /**
         * Boutons et actions. Sans cette famille, un `bg-white` de CTA n'avait
         * aucune cible tokenisée — or en clair un CTA blanc sur fond nacré doit
         * gagner un liseré (`border-cta-primary-border`) pour rester lisible.
         */
        cta: {
          "primary-bg": cssVar(CSS_VAR_NAMES.color.cta.primaryBg),
          "primary-bg-hover": cssVar(CSS_VAR_NAMES.color.cta.primaryBgHover),
          "primary-fg": cssVar(CSS_VAR_NAMES.color.cta.primaryFg),
          "primary-border": cssVar(CSS_VAR_NAMES.color.cta.primaryBorder),
          "secondary-bg": cssVar(CSS_VAR_NAMES.color.cta.secondaryBg),
          "secondary-bg-hover": cssVar(CSS_VAR_NAMES.color.cta.secondaryBgHover),
          "secondary-fg": cssVar(CSS_VAR_NAMES.color.cta.secondaryFg),
          "ghost-bg": cssVar(CSS_VAR_NAMES.color.cta.ghostBg),
          "ghost-bg-hover": cssVar(CSS_VAR_NAMES.color.cta.ghostBgHover),
          /** Texte sur aplat de marque — blanc dans les deux schémas. */
          "brand-fg": cssVar(CSS_VAR_NAMES.color.cta.brandFg),
        },

        /** Actions destructives. */
        danger: {
          DEFAULT: cssVar(CSS_VAR_NAMES.color.status.error.base),
          surface: cssVar(CSS_VAR_NAMES.color.danger.surface),
          "surface-hover": cssVar(CSS_VAR_NAMES.color.danger.surfaceHover),
          border: cssVar(CSS_VAR_NAMES.color.danger.border),
        },
      },
      fontSize: {
        "display-1": [
          "4.5rem",
          { lineHeight: "1.05", fontWeight: "800", letterSpacing: "-0.025em" },
        ],
        "display-2": [
          "3rem",
          { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.022em" },
        ],
        "display-3": [
          "2rem",
          { lineHeight: "1.15", fontWeight: "700", letterSpacing: "-0.02em" },
        ],
        "heading-1": [
          "1.5rem",
          { lineHeight: "1.25", fontWeight: "600" },
        ],
        "heading-2": [
          "1.25rem",
          { lineHeight: "1.3", fontWeight: "600" },
        ],
        "heading-3": [
          "1.125rem",
          { lineHeight: "1.4", fontWeight: "600" },
        ],
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
};

export default tentacleTailwindPreset;
