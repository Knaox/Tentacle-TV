import type { Root } from "postcss";
import type { CompatContext } from "./context";

/** Propriétés sans effet sur le socle, retirées pour que la garde soit nette. */
const INERT_PROPERTIES = ["content-visibility", "contain-intrinsic-size"];

/**
 * Retire ce qui n'a plus d'effet, et rien de plus.
 *
 * `content-visibility` et `contain-intrinsic-size` (Chrome 85) portent le
 * confinement de rendu des rangées. Sur ce socle ils sont ignorés : les
 * rangées hors écran seront peintes comme les autres. C'est une perte de
 * performance réelle, à mesurer sur l'appareil — pas un défaut d'affichage.
 *
 * Les blocs `@starting-style` (Chrome 117) sont retirés de même. Ils portent
 * l'état de départ des fondus d'apparition ; sans eux l'élément apparaît d'un
 * coup, ce que les feuilles d'`apps/web` documentent déjà comme la
 * dégradation attendue.
 *
 * **`overflow: clip` n'est PAS touché**, et ce n'est pas un oubli. Le
 * convertir en `hidden` ferait du `<body>` un conteneur de défilement, ce qui
 * casserait le virtualiseur de la bibliothèque — il mesure `window`. Le
 * laisser invalide est ici le bon comportement : la propriété est ignorée et
 * le défilement reste celui du document.
 */
export function cleanupPass(root: Root, context: CompatContext): void {
  root.walkDecls((declaration) => {
    if (!INERT_PROPERTIES.includes(declaration.prop)) return;
    declaration.remove();
    context.count("proprietes-inertes");
  });

  root.walkAtRules("starting-style", (rule) => {
    rule.remove();
    context.count("starting-style");
  });
}
