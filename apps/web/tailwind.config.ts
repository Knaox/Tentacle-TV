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
      // `shimmer` et `breathe` ont été retirés : aucun `animate-shimmer` ni
      // `animate-breathe` dans le code. Le premier faisait doublon avec la
      // classe `.skeleton-shimmer` d'index.css, le second animait `box-shadow`
      // en boucle — exactement l'anti-pattern qu'on vient de corriger sur les
      // cartes. Les laisser en config, c'était inviter à les réutiliser.
      animation: {
        "fade-slide-up": "fadeSlideUp 0.5s ease both",
        "fade-slide-down": "fadeSlideDown 0.3s ease both",
        "scale-in": "scaleIn 0.2s ease both",
        "slide-in-right": "slideInRight 0.25s ease both",
        // BORNÉE, comme tout ce qui bat dans cette application. Ces pastilles
        // signalent un état qui DURE — un téléchargement en cours, une
        // invitation reçue, une perte de réseau — et battaient donc aussi
        // longtemps que lui, dans une barre affichée sur toutes les pages.
        // Or une animation en cours force le navigateur à produire une image à
        // chaque rafraîchissement de l'écran : une seule suffit à empêcher le
        // GPU de redescendre en veille.
        // Dix battements (vingt secondes) attirent l'œil très largement ; après
        // quoi la pastille reste parfaitement visible, seul le battement cesse.
        // PAS de `forwards` : l'animation oscille entre 0,4 et 0,8 d'opacité, la
        // figer sur sa dernière image la laisserait au plus BAS. En la laissant
        // se terminer, l'élément reprend son opacité naturelle — pleine, donc
        // plus lisible encore qu'en battant.
        "pulse-glow": "pulseGlow 2s ease 10",
        "ken-burns": "kenBurns 32s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate",
        "fade-out": "fadeOut 0.3s ease forwards",
        "loading-bar": "loadingBar 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
      keyframes: {
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
        kenBurns: {
          "0%":   { transform: "scale(1) translate3d(0, 0, 0)" },
          "100%": { transform: "scale(1.18) translate3d(-2%, 1.2%, 0)" },
        },
        loadingBar: {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
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
