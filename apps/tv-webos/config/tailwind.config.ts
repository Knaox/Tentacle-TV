import type { Config } from "tailwindcss";
import { tentacleTailwindPreset } from "@tentacle-tv/theme/tailwind";
import configWeb from "../../web/tailwind.config";
import { presetTv } from "./presetTv";

/**
 * Configuration Tailwind de la cible téléviseur.
 *
 * Elle reprend celle du client web — c'est le même code source, donc les mêmes
 * classes à générer, et les animations déclarées là-bas doivent exister ici.
 * `presetTv` ne fait que passer après, pour ce qui change réellement sur une
 * dalle de salon.
 *
 * Le `content` doit couvrir les trois arbres que le bundle traverse :
 * `apps/web` (tout le JSX), `packages/ui` (les composants partagés), et le peu
 * de code propre à la cible. En oublier un ne casse pas le build — il produit
 * une feuille amputée des classes concernées, ce qui se voit à l'écran et non
 * dans la console.
 */
export default {
  presets: [tentacleTailwindPreset, presetTv],
  content: [
    "./client/index.html",
    "./client/src/**/*.{ts,tsx}",
    "../web/index.html",
    "../web/src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: configWeb.theme,
  // Les variables de départ des utilitaires (`--tw-translate-x`, `--tw-ring-*`,
  // `--tw-shadow`… cinquante et une) ne sont plus posées sur `*, ::before,
  // ::after` mais sur les seules classes qui les lisent. Sur la dalle, chaque
  // élément de chaque écran les recevait : mesuré sur la C3, en parcourant une
  // bibliothèque, le recalcul de style coûtait deux fois plus par élément, et
  // le quart de tout le travail de style y passait. Rendu identique — aucune
  // feuille ni style en ligne du dépôt ne lit une `--tw-*` hors des utilitaires.
  experimental: {
    optimizeUniversalDefaults: true,
  },
} satisfies Config;
