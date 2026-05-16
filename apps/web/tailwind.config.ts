import type { Config } from "tailwindcss";
import { tentacleTailwindPreset } from "@tentacle-tv/theme/tailwind";

/**
 * Token-driven entries (colors, fontFamily, fontSize, screens, backdropBlur)
 * live in the shared `@tentacle-tv/theme` preset — single source of truth for
 * the design system. App-specific animations/keyframes stay here because they
 * reference component-level visuals that don't belong to the token tree.
 */
export default {
  presets: [tentacleTailwindPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        shimmer: "shimmer 1.5s ease infinite",
        "fade-slide-up": "fadeSlideUp 0.5s ease both",
        "fade-slide-down": "fadeSlideDown 0.3s ease both",
        "scale-in": "scaleIn 0.2s ease both",
        "slide-in-right": "slideInRight 0.25s ease both",
        "pulse-glow": "pulseGlow 2s ease infinite",
        breathe: "breathe 2s ease infinite",
        "ken-burns": "kenBurns 32s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate",
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
          "0%, 100%": { boxShadow: "0 0 15px rgba(var(--brand-rgb), 0.3)" },
          "50%": { boxShadow: "0 0 25px rgba(var(--brand-rgb), 0.5)" },
        },
        kenBurns: {
          "0%":   { transform: "scale(1) translate3d(0, 0, 0)" },
          "100%": { transform: "scale(1.18) translate3d(-2%, 1.2%, 0)" },
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
