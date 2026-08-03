import type { Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/**
 * Retire les `@import` qui pointent hors du serveur.
 *
 * `apps/web/src/index.css` ouvre sur un `@import url(fonts.googleapis.com)`.
 * Un serveur Tentacle sur un réseau local sans accès extérieur ne le résoudra
 * jamais : le moteur attend, le premier tracé est retardé, puis la page tombe
 * sur la police système — dont les métriques ne sont pas celles pour lesquelles
 * l'échelle typographique a été réglée.
 *
 * Première passe de la chaîne : un `@import` doit rester en tête de feuille,
 * et aucune autre passe ne doit avoir à le contourner.
 */
export function passeImportsDistants(racine: Root, contexte: ContexteCompat): void {
  racine.walkAtRules("import", (regle) => {
    if (!/^\s*(url\(\s*)?["']?https?:/i.test(regle.params)) return;
    regle.remove();
    contexte.compter("imports-distants");
  });
}
