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
 * 1920 px de large tombe dans `2xl` (1536 px), le dernier palier de Tailwind.
 * `LibraryGrid` y demande huit affiches par rangée : lisible sur un moniteur
 * de bureau, illisible sur un téléviseur de salon. Le palier `tv` donne un
 * point d'accroche au-delà, que la feuille TV utilise pour revenir à une
 * densité tenable.
 */
const PALIERS_TV = {
  tv: "1600px",
};

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

export const presetTv: Partial<Config> = {
  theme: {
    extend: {
      screens: PALIERS_TV,
      backdropBlur: FLOU_NEUTRALISE,
    },
  },
};
