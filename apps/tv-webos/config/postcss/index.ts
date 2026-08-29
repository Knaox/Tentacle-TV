import type { Plugin } from "postcss";
import { createContext } from "./context";
import { remoteImportsPass } from "./remoteImportsPass";
import { modernPseudoPass } from "./modernPseudoPass";
import { fixedUnitsPass } from "./fixedUnitsPass";
import { gridPass } from "./gridPass";
import { gapPass } from "./gapPass";
import { ratiosPass } from "./ratiosPass";
import { glassPass } from "./glassPass";
import { hoverPass, survivingHovers } from "./hoverPass";
import { mathFunctionsPass } from "./mathFunctionsPass";
import { tokenFallbackPass } from "./tokenFallbackPass";
import { cleanupPass } from "./cleanupPass";
import { compatGuard, formatSurvivals } from "./compatGuard";

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
 *   1. `remoteImportsPass` d'abord — un `@import` doit rester en tête de
 *      feuille, aucune autre passe ne doit avoir à le contourner.
 *   2. `fixedUnitsPass` avant TOUTE transformation géométrique : les passes
 *      suivantes voient alors des pixels partout, y compris dans les
 *      demi-écarts qu'elles écrivent en `calc(… / 2)`.
 *   3. `modernPseudoPass` ensuite : elle réécrit des sélecteurs, et les passes
 *      suivantes clonent des règles.
 *   4. `gridPass` avant `gapPass` : le calcul de largeur d'une colonne doit être
 *      écrit tant que la relation à l'écart est encore lisible.
 *   5. `gapPass` ensuite, pour traiter d'un même geste les flexbox d'origine et
 *      les grilles converties.
 *   6. `ratiosPass`, `glassPass`, `hoverPass`, `mathFunctionsPass` et `cleanupPass` sont
 *      indépendantes.
 *   7. `tokenFallbackPass` avant `compatGuard` — c'est elle qui retire la déclaration
 *      trop récente d'un jeton qui porte DÉJÀ son repli, et sans elle la garde
 *      refuserait une convention qu'on veut au contraire encourager. Elle ne
 *      touche à rien qui n'ait pas de repli, donc elle n'affaiblit pas la
 *      garde : une primitive déclarée seule la fait toujours échouer.
 *   8. `compatGuard` en dernier, lectrice : elle refuse ce qui a survécu.
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
export function chrome53Compat(): Plugin {
  return {
    postcssPlugin: "tentacle-compat-chrome53",

    OnceExit(root) {
      const context = createContext();

      remoteImportsPass(root, context);
      fixedUnitsPass(root, context);
      modernPseudoPass(root, context);
      gridPass(root, context);
      gapPass(root, context);
      ratiosPass(root, context);
      glassPass(root, context);
      hoverPass(root, context);
      mathFunctionsPass(root, context);
      tokenFallbackPass(root, context);
      cleanupPass(root, context);

      // Auto-contrôle de la passe de survol : un reste ne signale pas une
      // régression du client web — la passe les retire tous par construction —
      // mais un défaut de son découpage de listes de sélecteurs.
      const hovers = survivingHovers(root);
      if (hovers.length > 0) {
        throw root.error(
          [
            `${hovers.length} règle(s) de survol ont échappé à la passe :`,
            ...hovers.slice(0, 10).map((selector) => `  ${selector}`),
            "",
            "Sur un téléviseur, le focus est la seule sélection. Voir",
            "config/postcss/hoverPass.ts.",
          ].join("\n"),
          { plugin: "tentacle-compat-chrome53" },
        );
      }

      const survivals = compatGuard(root);
      if (survivals.length > 0) {
        throw root.error(formatSurvivals(survivals), {
          plugin: "tentacle-compat-chrome53",
        });
      }

      if (!process.env.TV_COMPAT_SILENCIEUX) {
        console.log(`[compat-chrome53] ${context.report()}`);
      }
    },
  };
}

chrome53Compat.postcss = true;
