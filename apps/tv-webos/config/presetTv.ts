import type { Config } from "tailwindcss";

/**
 * Ce que la cible téléviseur ajoute au preset partagé.
 *
 * Le socle est `@tentacle-tv/theme/tailwind`, comme partout ailleurs : les
 * couleurs, la typographie et les rayons restent ceux du reste de l'écosystème,
 * et un changement de jeton se propage ici comme sur le web.
 *
 * Deux ajouts seulement, et ils ont la même cause — un téléviseur se regarde de
 * trois mètres, pas de cinquante centimètres.
 */

/**
 * Aucun palier ajouté, et c'est le résultat du canevas 1280.
 *
 * Le client composait à 1920, donc dans `2xl` (1536 px) : `LibraryGrid` y
 * demandait huit affiches par rangée, illisibles à trois mètres. Un palier
 * `tv` au-delà de `2xl` n'aurait fait que rattraper le symptôme.
 *
 * À 1280, `2xl` cesse simplement de s'appliquer : la grille retombe sur `xl`
 * et sort six colonnes, sans qu'aucune règle nouvelle soit écrite. Les
 * composants d'`apps/web` se disposent comme sur un portable — ce pour quoi
 * ils ont été dessinés.
 */
const PALIERS_TV = {};

/**
 * Le flou d'arrière-plan est retiré du bundle téléviseur — il n'arrive qu'à
 * Chrome 76 alors que le socle est Chrome 53, et il coûterait de toute façon
 * bien trop cher au processeur graphique d'une dalle. Plutôt que de traquer
 * les trente-neuf classes `backdrop-blur-*` écrites à la main dans `apps/web`,
 * on vide l'échelle : chaque classe existe toujours, mais ne produit plus
 * rien. La passe PostCSS `verre` retire ensuite les déclarations devenues
 * vides, et la feuille TV rend les surfaces opaques.
 */
const FLOU_NEUTRALISE = {
  0: "0",
  none: "0",
  sm: "0",
  DEFAULT: "0",
  md: "0",
  lg: "0",
  xl: "0",
  "2xl": "0",
  "3xl": "0",
};

/**
 * La police du système webOS, dessinée pour être lue de loin et déjà présente
 * sur la dalle. Le preset partagé demande Inter, que `apps/web` charge depuis
 * Google Fonts — un serveur sur réseau local sans accès extérieur ne l'aurait
 * jamais servie, et la passe `importsDistants` a retiré cet import.
 */
const POLICE_TV = ['"LG Smart UI"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"];

export const presetTv: Partial<Config> = {
  theme: {
    extend: {
      screens: PALIERS_TV,
      backdropBlur: FLOU_NEUTRALISE,
      fontFamily: { sans: POLICE_TV },
    },
  },
};
