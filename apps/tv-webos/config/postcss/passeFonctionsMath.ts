import { decl as creerDeclaration, type Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/** Propriétés dont la borne se dit avec un `max-` ou un `min-`. */
const BORNES: Record<string, { max: string; min: string }> = {
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
export function passeFonctionsMath(racine: Root, contexte: ContexteCompat): void {
  racine.walkDecls((declaration) => {
    const fonction = /^(min|max)\((.*)\)$/s.exec(declaration.value.trim());
    if (!fonction) return;

    const bornes = BORNES[declaration.prop];
    if (!bornes) return;

    const arguments_ = decouperArguments(fonction[2]);
    if (arguments_.length !== 2) return;

    const [valeur, borne] = arguments_;
    declaration.value = valeur;
    declaration.after(
      creerDeclaration({
        prop: fonction[1] === "min" ? bornes.max : bornes.min,
        value: borne,
      }),
    );
    contexte.compter("fonctions-de-comparaison");
  });
}

/** Découpe sur les virgules du premier niveau, en ignorant celles des `calc()`. */
function decouperArguments(contenu: string): string[] {
  const arguments_: string[] = [];
  let profondeur = 0;
  let courant = "";

  for (const caractere of contenu) {
    if (caractere === "(") profondeur++;
    else if (caractere === ")") profondeur--;

    if (caractere === "," && profondeur === 0) {
      arguments_.push(courant.trim());
      courant = "";
      continue;
    }
    courant += caractere;
  }

  if (courant.trim().length > 0) arguments_.push(courant.trim());
  return arguments_;
}
