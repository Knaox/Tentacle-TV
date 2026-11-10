import type { Config } from "tailwindcss";
import { CSS_VAR_NAMES, cssVar } from "../css/varNames";
import { DEFAULT_TYPOGRAPHY_TOKENS } from "../tokens/typography";

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
  // Un `hover:` ne vaut qu'à la souris : Tailwind l'enferme dans
  // `@media (hover: hover) and (pointer: fine)`. Au doigt, un survol reste collé après le
  // toucher — un bouton « allumé » qu'on vient de quitter. Vaut pour `group-hover:` aussi.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      screens: {
        xs: "360px",
      },
      fontFamily: {
        // DÉRIVÉE du jeton, jamais recopiée. La pile était écrite deux fois —
        // ici et dans `tokens/typography.ts` — et c'est cette copie-ci que
        // Tailwind lit : corriger le jeton seul ne changeait rien au CSS
        // produit. Le doublon a coûté une police embarquée qui ne servait pas.
        sans: DEFAULT_TYPOGRAPHY_TOKENS.fontFamily.sans.split(", "),
        // Les titres (Bricolage Grotesque). Par la VARIABLE, pas par la pile : le client LG la
        // redéfinit sur la police de sa dalle, et une classe `font-display` doit le suivre.
        display: ["var(--font-display)"],
      },
      // Les rayons de la refonte, par RÔLE (cf. docs/REFONTE-UI.md) — à préférer aux paliers de
      // Tailwind dans tout code nouveau. `lg` passe de 8 à 10 px : c'est le rayon des champs.
      borderRadius: {
        lg: "10px",
        chip: cssVar(CSS_VAR_NAMES.radius.sm),
        field: cssVar(CSS_VAR_NAMES.radius.md),
        card: cssVar(CSS_VAR_NAMES.radius.lg),
        tile: cssVar(CSS_VAR_NAMES.radius.xl),
        panel: cssVar(CSS_VAR_NAMES.radius.xl2),
        sheet: cssVar(CSS_VAR_NAMES.radius.xl3),
        pill: cssVar(CSS_VAR_NAMES.radius.pill),
      },
      boxShadow: {
        edge: cssVar(CSS_VAR_NAMES.shadow.edge),
        "image-edge": cssVar(CSS_VAR_NAMES.shadow.imageEdge),
        menu: cssVar(CSS_VAR_NAMES.shadow.dropdown),
        sheet: cssVar(CSS_VAR_NAMES.shadow.modal),
        "elev-1": cssVar(CSS_VAR_NAMES.shadow.elev1),
        "elev-2": cssVar(CSS_VAR_NAMES.shadow.elev2),
        "elev-3": cssVar(CSS_VAR_NAMES.shadow.elev3),
      },
      transitionTimingFunction: {
        out: cssVar(CSS_VAR_NAMES.motion.easing.out),
        "in-out": cssVar(CSS_VAR_NAMES.motion.easing.inOut),
        drawer: cssVar(CSS_VAR_NAMES.motion.easing.drawer),
      },
      transitionDuration: {
        press: cssVar(CSS_VAR_NAMES.motion.duration.press),
        hover: cssVar(CSS_VAR_NAMES.motion.duration.hover),
        "menu-in": cssVar(CSS_VAR_NAMES.motion.duration.menuIn),
        "menu-out": cssVar(CSS_VAR_NAMES.motion.duration.menuOut),
        card: cssVar(CSS_VAR_NAMES.motion.duration.card),
        "sheet-in": cssVar(CSS_VAR_NAMES.motion.duration.sheetIn),
        "sheet-out": cssVar(CSS_VAR_NAMES.motion.duration.sheetOut),
      },
      colors: {
        surface: {
          0: cssVar(CSS_VAR_NAMES.color.surface.s0),
          1: cssVar(CSS_VAR_NAMES.color.surface.s1),
          2: cssVar(CSS_VAR_NAMES.color.surface.s2),
          3: cssVar(CSS_VAR_NAMES.color.surface.s3),
          4: cssVar(CSS_VAR_NAMES.color.surface.s4),
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
        /**
         * La teinte franche des états actifs. `<alpha-value>` : `bg-accent/20` compose son
         * opacité ; `soft` et `on` sont des `var()` — sur eux, jamais de `/opacité`
         * (cf. apps/web/src/theme/alphaModifier.test.ts).
         */
        accent: {
          DEFAULT: `rgba(var(${CSS_VAR_NAMES.color.accent.rgb}), <alpha-value>)`,
          soft: cssVar(CSS_VAR_NAMES.color.accent.soft),
          on: cssVar(CSS_VAR_NAMES.color.accent.on),
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
          muted: cssVar(CSS_VAR_NAMES.color.onMedia.muted),
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
          { lineHeight: "0.98", fontWeight: "780", letterSpacing: "-0.035em" },
        ],
        "display-2": [
          "3rem",
          { lineHeight: "1.02", fontWeight: "740", letterSpacing: "-0.03em" },
        ],
        "display-3": [
          "2rem",
          { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.025em" },
        ],
        "heading-1": [
          "1.5rem",
          { lineHeight: "1.15", fontWeight: "650", letterSpacing: "-0.02em" },
        ],
        "heading-2": [
          "1.25rem",
          { lineHeight: "1.2", fontWeight: "650", letterSpacing: "-0.015em" },
        ],
        "heading-3": [
          "1.125rem",
          { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" },
        ],
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
};

export default tentacleTailwindPreset;
