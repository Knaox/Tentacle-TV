import type { Root } from "postcss";
import type { CompatContext } from "./context";

/**
 * Ramène les pseudo-classes récentes à ce que Chrome 53 sait lire.
 *
 * Un sélecteur inconnu n'est pas ignoré : il invalide la règle **entière**.
 * Deux conséquences, invisibles depuis les sources parce que ce CSS est
 * produit par Tailwind et n'existe nulle part dans le dépôt :
 *
 *   - `button, input:where([type=button]), …{background-color:transparent}`
 *     est la règle du preflight qui neutralise le fond natif des boutons. Sans
 *     elle, chaque bouton de l'application reprend le dégradé gris du moteur.
 *   - `[hidden]:where(:not([hidden=until-found])){display:none}` est ce qui
 *     fait que l'attribut `hidden` cache quelque chose.
 *
 * `:focus-visible` devient `:focus`, sans polyfill. Sur un téléviseur il n'y a
 * ni souris ni doigt : les deux sont sémantiquement identiques. Un polyfill
 * décide de la « modalité » d'après le dernier événement d'entrée, et
 * classerait « programmatique » le cas qui compte le plus ici — la remise au
 * point du focus après qu'un défilement a monté de nouvelles cartes, qui se
 * produit dans un rappel d'observateur, hors de tout événement clavier. Il
 * retirerait l'anneau exactement quand l'utilisateur en a le plus besoin.
 *
 * Passe exécutée avant toute transformation géométrique : elle réécrit des
 * sélecteurs, et les passes suivantes clonent des règles.
 */
export function modernPseudoPass(root: Root, context: CompatContext): void {
  root.walkRules((rule) => {
    const origin = rule.selector;
    let selector = origin;

    if (selector.includes(":focus-visible")) {
      selector = selector.replace(/:focus-visible/g, ":focus");
      context.count("focus-visible");
    }

    if (selector.includes(":where(") || selector.includes(":is(")) {
      const expanded = unwrapEnvelopes(selector);
      if (expanded !== selector) {
        selector = expanded;
        context.count("pseudo-fonctionnelles");
      }
    }

    if (selector !== origin) rule.selector = selector;
  });
}

/**
 * Retire les enveloppes `:where(…)` et `:is(…)` en conservant leur contenu.
 *
 * La spécificité change — `:where()` la met à zéro — mais aucune des cinq
 * règles concernées ne s'appuie sur cette propriété : ce sont des règles de
 * preflight, seules à cibler ce qu'elles ciblent.
 *
 * Une enveloppe contenant une virgule au premier niveau demanderait d'éclater
 * le sélecteur en plusieurs ; le cas ne se présente pas dans ce qu'émet
 * Tailwind 3, et la laisser intacte vaut mieux qu'une réécriture approximative
 * — `compatGuard` la signalera en fin de build.
 */
function unwrapEnvelopes(selector: string): string {
  let result = selector;

  for (const envelope of [":where(", ":is("]) {
    let start = result.indexOf(envelope);
    while (start !== -1) {
      const opening = start + envelope.length - 1;
      const closing = findClosing(result, opening);
      if (closing === -1) break;

      const content = result.slice(opening + 1, closing);
      if (content.includes(",")) {
        start = result.indexOf(envelope, start + 1);
        continue;
      }

      result = result.slice(0, start) + content + result.slice(closing + 1);
      start = result.indexOf(envelope);
    }
  }

  return result;
}

/** Index de la parenthèse fermante appariée, ou -1. */
function findClosing(text: string, opening: number): number {
  let depth = 0;
  for (let i = opening; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
