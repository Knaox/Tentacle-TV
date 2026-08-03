import type { Plugin } from "postcss";
import { creerContexte } from "./contexte";

/**
 * Compatibilité CSS avec le socle Chrome 53.
 *
 * S'exécute **après Tailwind et après autoprefixer**, et c'est essentiel :
 * `:where()`, `grid-template-columns: repeat(N, minmax(0,1fr))`,
 * `aspect-ratio: 2/3` et les variantes `:focus-visible` n'existent nulle part
 * dans les sources du dépôt — ils sont produits par Tailwind. Une passe qui
 * s'exécuterait avant ne verrait rien à transformer.
 *
 * Les passes sont ajoutées à la phase suivante ; ce fichier fixe dès
 * maintenant la place du plugin dans la chaîne, pour que la mesure de taille
 * et de temps de démarrage porte sur la chaîne définitive.
 */
export function compatibiliteChrome53(): Plugin {
  const contexte = creerContexte();

  return {
    postcssPlugin: "tentacle-compat-chrome53",

    OnceExit() {
      if (!process.env.TV_COMPAT_SILENCIEUX) {
        console.log(`[compat-chrome53] ${contexte.rapport()}`);
      }
    },
  };
}

compatibiliteChrome53.postcss = true;
