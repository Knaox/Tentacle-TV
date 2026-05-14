/**
 * NativeWind config — étendu pour exposer les tokens partagés
 * (`@tentacle-tv/shared/theme`) côté classes Tailwind utilitaires.
 *
 * Conservation back-compat de `colors.tentacle` (consommé par certains
 * écrans existants), mais valeurs ré-alignées sur SURFACE.s0/s1/s2/BRAND.violet.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Back-compat alias
        tentacle: {
          bg: "#000000",
          surface: "#0a0a0a",
          surfaceElevated: "#141414",
          border: "rgba(255,255,255,0.08)",
          accent: "#8B5CF6",
          accentDark: "#7C3AED",
          accentLight: "#A78BFA",
        },
        // Nouveau langage cinématographique (aligné web tokens.css)
        surface: {
          0: "#000000",
          1: "#0a0a0a",
          2: "#141414",
          3: "#1f1f1f",
        },
        brand: {
          DEFAULT: "#8B5CF6",
          light: "#A78BFA",
          dark: "#7C3AED",
          soft: "rgba(139, 92, 246, 0.15)",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "rgba(255, 255, 255, 0.78)",
          tertiary: "rgba(255, 255, 255, 0.55)",
          quaternary: "rgba(255, 255, 255, 0.34)",
          disabled: "rgba(255, 255, 255, 0.22)",
        },
        cta: {
          primaryBg: "#FFFFFF",
          primaryFg: "#000000",
          secondaryBg: "rgba(109,109,110,0.55)",
          secondaryFg: "#FFFFFF",
          ghostBg: "rgba(255,255,255,0.08)",
        },
        status: {
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
          info: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["Inter_400Regular", "system-ui", "-apple-system", "sans-serif"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
        extrabold: ["Inter_800ExtraBold"],
      },
      fontSize: {
        "display-1": ["56px", { lineHeight: "1.05", letterSpacing: "-0.5px" }],
        "display-2": ["44px", { lineHeight: "1.05", letterSpacing: "-0.5px" }],
        "display-3": ["32px", { lineHeight: "1.1", letterSpacing: "-0.4px" }],
        "heading-1": ["24px", { lineHeight: "1.25", letterSpacing: "-0.4px" }],
        "heading-2": ["20px", { lineHeight: "1.25", letterSpacing: "-0.4px" }],
        "heading-3": ["18px", { lineHeight: "1.3", letterSpacing: "-0.4px" }],
        body: ["15px", { lineHeight: "1.5" }],
        caption: ["13px", { lineHeight: "1.5" }],
        small: ["11px", { lineHeight: "1.4" }],
        badge: ["10px", { lineHeight: "1.2", letterSpacing: "0.3px" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};
