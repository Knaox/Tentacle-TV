import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "360px",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        // Semantic surface tokens (preferred — consume via theme)
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          light: "var(--brand-light)",
          dark: "var(--brand-dark)",
        },
        // Legacy tentacle namespace — kept for backwards compat during migration.
        // Maps onto the new tokens so existing classes (`bg-tentacle-bg`) keep working.
        tentacle: {
          bg: "var(--surface-0)",
          surface: "var(--surface-1)",
          border: "var(--border-subtle)",
          accent: "var(--brand)",
          "accent-dark": "var(--brand-dark)",
          "accent-light": "var(--brand-light)",
          "accent-muted": "var(--brand-light)",
        },
        status: {
          success: "var(--status-success)",
          warning: "var(--status-warning)",
          error: "var(--status-error)",
          info: "var(--status-info)",
        },
      },
      fontSize: {
        // Cinematic display scale
        "display-1": ["4.5rem", { lineHeight: "1.05", fontWeight: "800", letterSpacing: "-0.025em" }],
        "display-2": ["3rem", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.022em" }],
        "display-3": ["2rem", { lineHeight: "1.15", fontWeight: "700", letterSpacing: "-0.02em" }],
        "heading-1": ["1.5rem", { lineHeight: "1.25", fontWeight: "600" }],
        "heading-2": ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        "heading-3": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        shimmer: "shimmer 1.5s ease infinite",
        "fade-slide-up": "fadeSlideUp 0.5s ease both",
        "fade-slide-down": "fadeSlideDown 0.3s ease both",
        "scale-in": "scaleIn 0.2s ease both",
        "slide-in-right": "slideInRight 0.25s ease both",
        "pulse-glow": "pulseGlow 2s ease infinite",
        breathe: "breathe 2s ease infinite",
        "ken-burns": "kenBurns 20s ease-in-out infinite alternate",
        "fade-out": "fadeOut 0.3s ease forwards",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeSlideDown: {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(30px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        breathe: {
          "0%, 100%": { boxShadow: "0 0 15px rgba(139,92,246,0.3)" },
          "50%": { boxShadow: "0 0 25px rgba(139,92,246,0.5)" },
        },
        kenBurns: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.05)" },
        },
        fadeOut: {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(20px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
