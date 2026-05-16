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
        status: {
          success: cssVar(CSS_VAR_NAMES.color.status.success.base),
          warning: cssVar(CSS_VAR_NAMES.color.status.warning.base),
          error: cssVar(CSS_VAR_NAMES.color.status.error.base),
          info: cssVar(CSS_VAR_NAMES.color.status.info.base),
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
