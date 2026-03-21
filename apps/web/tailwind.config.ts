import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        tentacle: {
          bg: "#080812",
          surface: "#12121a",
          border: "#1e1e2e",
          accent: "#8b5cf6",
          "accent-dark": "#7C3AED",
          "accent-light": "#a78bfa",
          "accent-muted": "#C4B5FD",
        },
        status: {
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
          info: "#3b82f6",
        },
      },
      fontSize: {
        "heading-1": ["2.25rem", { lineHeight: "1.2", fontWeight: "700" }],
        "heading-2": ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
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
