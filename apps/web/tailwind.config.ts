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
        // BRIDÉ à trente images par seconde, comme les zooms de la bannière
        // d'accueil (cf. `cadence` dans src/theme/motion.ts). Dix-huit pour cent
        // d'échelle étalés sur trente-deux secondes, c'est moins d'un vingtième
        // de pixel de progression entre deux images à 120 Hz — et une
        // recomposition d'image plein cadre à chaque fois.
        //
        // `steps()` s'applique à CHAQUE intervalle entre keyframes. Ceux-ci sont
        // espacés de 5 %, soit 1,6 s : 48 paliers par intervalle donnent donc
        // exactement 30 par seconde, quelle que soit la fréquence de l'écran.
        // Aucune détection de plateforme, ici comme ailleurs.
        "ken-burns": "kenBurns 32s steps(48) infinite alternate",
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
        // La courbe `cubic-bezier(0.16, 1, 0.3, 1)` d'origine ne vit plus dans la
        // timing function — `steps()` l'aurait écrasée et le travelling serait
        // devenu linéaire. Elle est donc ÉCHANTILLONNÉE ici, tous les 5 %, aux
        // valeurs exactes de la bezier. Le mouvement est conservé : il démarre
        // vif puis s'apaise, très précisément comme avant.
        // Écart maximal de l'approximation par segments : 0,152 % d'échelle,
        // soit un pixel et demi sur une image de mille — un écart de position
        // sur trente-deux secondes, pas un à-coup.
        // Les derniers paliers sont identiques parce que la courbe y est plate,
        // ce n'est pas une erreur de recopie.
        kenBurns: {
          "0%": { transform: "scale(1.0000) translate3d(0.000%, 0.000%, 0)" },
          "5%": { transform: "scale(1.0506) translate3d(-0.562%, 0.337%, 0)" },
          "10%": { transform: "scale(1.0890) translate3d(-0.989%, 0.593%, 0)" },
          "15%": { transform: "scale(1.1164) translate3d(-1.293%, 0.776%, 0)" },
          "20%": { transform: "scale(1.1354) translate3d(-1.504%, 0.903%, 0)" },
          "25%": { transform: "scale(1.1486) translate3d(-1.651%, 0.991%, 0)" },
          "30%": { transform: "scale(1.1579) translate3d(-1.754%, 1.053%, 0)" },
          "35%": { transform: "scale(1.1645) translate3d(-1.827%, 1.096%, 0)" },
          "40%": { transform: "scale(1.1692) translate3d(-1.880%, 1.128%, 0)" },
          "45%": { transform: "scale(1.1725) translate3d(-1.917%, 1.150%, 0)" },
          "50%": { transform: "scale(1.1749) translate3d(-1.944%, 1.166%, 0)" },
          "55%": { transform: "scale(1.1766) translate3d(-1.963%, 1.178%, 0)" },
          "60%": { transform: "scale(1.1778) translate3d(-1.976%, 1.186%, 0)" },
          "65%": { transform: "scale(1.1787) translate3d(-1.985%, 1.191%, 0)" },
          "70%": { transform: "scale(1.1792) translate3d(-1.991%, 1.195%, 0)" },
          "75%": { transform: "scale(1.1796) translate3d(-1.995%, 1.197%, 0)" },
          "80%": { transform: "scale(1.1798) translate3d(-1.998%, 1.199%, 0)" },
          "85%": { transform: "scale(1.1799) translate3d(-1.999%, 1.199%, 0)" },
          "90%": { transform: "scale(1.1800) translate3d(-2.000%, 1.200%, 0)" },
          "95%": { transform: "scale(1.1800) translate3d(-2.000%, 1.200%, 0)" },
          "100%": { transform: "scale(1.1800) translate3d(-2.000%, 1.200%, 0)" },
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
