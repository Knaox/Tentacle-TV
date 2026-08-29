import type { Root } from "postcss";
import type { CompatContext } from "./context";

/**
 * Éteint le survol.
 *
 * Les autres passes de ce répertoire traitent des primitives trop récentes pour
 * Chrome 53. Celle-ci est d'une autre nature : `:hover` est parfaitement compris
 * par le socle, et c'est précisément le problème. Sur un téléviseur, **le focus
 * est la seule sélection**. Une carte qui s'agrandit parce que le pointeur de la
 * Magic Remote l'a effleurée désigne autre chose que l'anneau de focus, et
 * l'utilisateur se retrouve avec deux curseurs qui se contredisent.
 *
 * La feuille produite en portait soixante-dix-neuf, dont dix-sept `group-hover`
 * — aucune n'est écrite à la main : elles viennent des variantes Tailwind
 * d'`apps/web`, qui n'a pas à savoir qu'un téléviseur existe. Les retirer ici
 * est le seul point où l'on peut le faire sans toucher au client web.
 *
 * Un sélecteur peut être une liste : `.a:hover, .b` ne perd que sa première
 * part. On découpe donc sur les virgules de premier niveau, on écarte les parts
 * qui portent `:hover`, et la règle n'est supprimée que s'il n'en reste aucune.
 * Découper naïvement sur `,` casserait `:not(a, b)` et `[titre="x, y"]`.
 *
 * Ce qui n'est PAS traité ici, parce que ce n'est pas du CSS : les gestionnaires
 * `onMouseEnter` du client web, qui pilotent `data-hovered` et le panneau
 * d'aperçu. Ceux-là passent par les substitutions de modules.
 */
export function hoverPass(root: Root, context: CompatContext): void {
  root.walkRules((rule) => {
    if (!rule.selector.includes(":hover")) return;

    const kept = splitList(rule.selector).filter((part) => !part.includes(":hover"));

    if (kept.length === 0) {
      rule.remove();
      context.count("survol");
      return;
    }

    rule.selector = kept.join(", ");
    context.count("survol");
  });
}

/**
 * Ce qui reste de survol après la passe.
 *
 * Rendue plutôt que levée, comme `compatGuard` : l'appelant décide. Le cas
 * normal est une liste vide — un retour non vide signale un défaut du découpage
 * ci-dessus, pas une régression du client web.
 */
export function survivingHovers(root: Root): string[] {
  const remainders: string[] = [];
  root.walkRules((rule) => {
    if (rule.selector.includes(":hover")) remainders.push(rule.selector);
  });
  return remainders;
}

/** Découpe une liste de sélecteurs sur ses virgules de premier niveau. */
function splitList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;

  for (let i = 0; i < selector.length; i++) {
    const character = selector[i];

    if (quote) {
      if (character === quote && selector[i - 1] !== "\\") quote = null;
      continue;
    }

    if (character === '"' || character === "'") quote = character;
    else if (character === "(" || character === "[") depth++;
    else if (character === ")" || character === "]") depth--;
    else if (character === "," && depth === 0) {
      parts.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(selector.slice(start).trim());
  return parts.filter((part) => part.length > 0);
}
