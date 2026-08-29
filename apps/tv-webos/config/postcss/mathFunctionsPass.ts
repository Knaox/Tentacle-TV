import { decl as createDecl, type Root } from "postcss";
import type { CompatContext } from "./context";

/** Propriétés dont la borne se dit avec un `max-` ou un `min-`. */
const BOUNDS: Record<string, { max: string; min: string }> = {
  width: { max: "max-width", min: "min-width" },
  height: { max: "max-height", min: "min-height" },
};

/**
 * Traduit `min()` et `max()` en bornes explicites.
 *
 * Les fonctions de comparaison arrivent avec Chrome 79. Une déclaration qui en
 * contient est simplement ignorée par un moteur antérieur — la propriété
 * retombe à sa valeur héritée, sans le moindre avertissement.
 *
 * Pour une largeur ou une hauteur, la traduction est exacte et non
 * approchée : `width: min(A, B)` dit « A, sans jamais dépasser B », ce qui
 * s'écrit `width: A; max-width: B`. Symétriquement pour `max()`.
 *
 * Les autres cas — `clamp()`, une fonction de comparaison sur une propriété
 * sans borne, plus de deux arguments — ne sont pas devinés : la garde les
 * refuse, ce qui vaut mieux qu'une traduction plausible mais fausse.
 */
export function mathFunctionsPass(root: Root, context: CompatContext): void {
  root.walkDecls((declaration) => {
    const fn = /^(min|max)\((.*)\)$/s.exec(declaration.value.trim());
    if (!fn) return;

    const bounds = BOUNDS[declaration.prop];
    if (!bounds) return;

    const arguments_ = splitArguments(fn[2]);
    if (arguments_.length !== 2) return;

    const [value, borne] = arguments_;
    declaration.value = value;
    declaration.after(
      createDecl({
        prop: fn[1] === "min" ? bounds.max : bounds.min,
        value: borne,
      }),
    );
    context.count("fonctions-de-comparaison");
  });
}

/** Découpe sur les virgules du premier niveau, en ignorant celles des `calc()`. */
function splitArguments(content: string): string[] {
  const arguments_: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of content) {
    if (character === "(") depth++;
    else if (character === ")") depth--;

    if (character === "," && depth === 0) {
      arguments_.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim().length > 0) arguments_.push(current.trim());
  return arguments_;
}
