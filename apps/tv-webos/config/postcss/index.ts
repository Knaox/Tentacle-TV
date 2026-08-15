import type { Plugin } from "postcss";
import { creerContexte } from "./contexte";
import { passeImportsDistants } from "./passeImportsDistants";
import { passePseudoModernes } from "./passePseudoModernes";
import { passeUnitesFixes } from "./passeUnitesFixes";
import { passeGrille } from "./passeGrille";
import { passeEcarts } from "./passeEcarts";
import { passeRatios } from "./passeRatios";
import { passeVerre } from "./passeVerre";
import { passeSurvol, survolsSurvivants } from "./passeSurvol";
import { passeFonctionsMath } from "./passeFonctionsMath";
import { passeRepliJeton } from "./passeRepliJeton";
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
 *   2. `unitesFixes` avant TOUTE transformation géométrique : les passes
 *      suivantes voient alors des pixels partout, y compris dans les
 *      demi-écarts qu'elles écrivent en `calc(… / 2)`.
 *   3. `pseudoModernes` ensuite : elle réécrit des sélecteurs, et les passes
 *      suivantes clonent des règles.
 *   4. `grille` avant `ecarts` : le calcul de largeur d'une colonne doit être
 *      écrit tant que la relation à l'écart est encore lisible.
 *   5. `ecarts` ensuite, pour traiter d'un même geste les flexbox d'origine et
 *      les grilles converties.
 *   6. `ratios`, `verre`, `survol`, `fonctionsMath` et `nettoyage` sont
 *      indépendantes.
 *   7. `repliJeton` avant `gardeCompat` — c'est elle qui retire la déclaration
 *      trop récente d'un jeton qui porte DÉJÀ son repli, et sans elle la garde
 *      refuserait une convention qu'on veut au contraire encourager. Elle ne
 *      touche à rien qui n'ait pas de repli, donc elle n'affaiblit pas la
 *      garde : une primitive déclarée seule la fait toujours échouer.
 *   8. `gardeCompat` en dernier, lectrice : elle refuse ce qui a survécu.
 *
 * `survol` est la seule passe qui ne traite pas une primitive trop récente :
 * `:hover` est parfaitement compris par Chrome 53, et c'est le problème. Elle
 * est ici parce que c'est le seul endroit d'où l'on peut retirer les variantes
 * de survol que Tailwind produit pour `apps/web`, sans toucher au client web.
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
      passeUnitesFixes(racine, contexte);
      passePseudoModernes(racine, contexte);
      passeGrille(racine, contexte);
      passeEcarts(racine, contexte);
      passeRatios(racine, contexte);
      passeVerre(racine, contexte);
      passeSurvol(racine, contexte);
      passeFonctionsMath(racine, contexte);
      passeRepliJeton(racine, contexte);
      passeNettoyage(racine, contexte);

      // Auto-contrôle de la passe de survol : un reste ne signale pas une
      // régression du client web — la passe les retire tous par construction —
      // mais un défaut de son découpage de listes de sélecteurs.
      const survols = survolsSurvivants(racine);
      if (survols.length > 0) {
        throw racine.error(
          [
            `${survols.length} règle(s) de survol ont échappé à la passe :`,
            ...survols.slice(0, 10).map((selecteur) => `  ${selecteur}`),
            "",
            "Sur un téléviseur, le focus est la seule sélection. Voir",
            "config/postcss/passeSurvol.ts.",
          ].join("\n"),
          { plugin: "tentacle-compat-chrome53" },
        );
      }

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
