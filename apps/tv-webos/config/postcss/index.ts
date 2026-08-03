import type { Plugin } from "postcss";
import { creerContexte } from "./contexte";
import { passeImportsDistants } from "./passeImportsDistants";
import { passePseudoModernes } from "./passePseudoModernes";
import { passeGrille } from "./passeGrille";
import { passeEcarts } from "./passeEcarts";
import { passeRatios } from "./passeRatios";
import { passeVerre } from "./passeVerre";
import { passeFonctionsMath } from "./passeFonctionsMath";
import { passeNettoyage } from "./passeNettoyage";
import { gardeCompat, formaterSurvivances } from "./gardeCompat";

/**
 * Compatibilité CSS avec le socle Chrome 53.
 *
 * S'exécute **après Tailwind et après autoprefixer**, et c'est essentiel :
 * `:where()`, `grid-template-columns: repeat(N, minmax(0,1fr))`,
 * `aspect-ratio: 2/3` et les variantes `:focus-visible` n'existent nulle part
 * dans les sources du dépôt — ils sont produits par Tailwind. Une passe qui
 * s'exécuterait avant ne verrait rien à transformer.
 *
 * L'ordre des passes n'est pas arbitraire :
 *
 *   1. `importsDistants` d'abord — un `@import` doit rester en tête de
 *      feuille, aucune autre passe ne doit avoir à le contourner.
 *   2. `pseudoModernes` avant toute transformation géométrique : elle réécrit
 *      des sélecteurs, et les passes suivantes clonent des règles.
 *   3. `grille` avant `ecarts` : le calcul de largeur d'une colonne doit être
 *      écrit tant que la relation à l'écart est encore lisible.
 *   4. `ecarts` ensuite, pour traiter d'un même geste les flexbox d'origine et
 *      les grilles converties.
 *   5. `ratios`, `verre`, `fonctionsMath` et `nettoyage` sont indépendantes.
 *   6. `gardeCompat` en dernier, lectrice : elle refuse ce qui a survécu.
 *
 * Le rapport imprimé en fin de build n'est pas décoratif. Une passe qui
 * rapporte zéro est le signal le plus important : soit la primitive a disparu
 * du code, soit la passe ne s'exécute plus au bon endroit de la chaîne.
 */
export function compatibiliteChrome53(): Plugin {
  return {
    postcssPlugin: "tentacle-compat-chrome53",

    OnceExit(racine) {
      const contexte = creerContexte();

      passeImportsDistants(racine, contexte);
      passePseudoModernes(racine, contexte);
      passeGrille(racine, contexte);
      passeEcarts(racine, contexte);
      passeRatios(racine, contexte);
      passeVerre(racine, contexte);
      passeFonctionsMath(racine, contexte);
      passeNettoyage(racine, contexte);

      const survivances = gardeCompat(racine);
      if (survivances.length > 0) {
        throw racine.error(formaterSurvivances(survivances), {
          plugin: "tentacle-compat-chrome53",
        });
      }

      if (!process.env.TV_COMPAT_SILENCIEUX) {
        console.log(`[compat-chrome53] ${contexte.rapport()}`);
      }
    },
  };
}

compatibiliteChrome53.postcss = true;
