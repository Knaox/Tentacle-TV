import { rule as creerRegle, decl as creerDeclaration, type Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/** Variable qui transporte l'écart d'un conteneur vers le calcul de largeur. */
export const VARIABLE_ECART = "--tv-ecart";

/**
 * Convertit la grille CSS en flexbox.
 *
 * CSS Grid arrive avec Chrome 57 ; sur un moteur antérieur, `display: grid`
 * est une valeur inconnue et l'élément reste en bloc — la bibliothèque devient
 * une colonne d'affiches pleine largeur.
 *
 * La conversion est mécanique parce que l'usage l'est : dans le périmètre du
 * téléviseur, toutes les grilles sont des `repeat(N, minmax(0, 1fr))`, sans
 * `grid-template-areas` ni placement explicite. Les deux seules formes
 * complexes du dépôt vivent dans l'éditeur de jetons de l'administration, hors
 * périmètre.
 *
 * La largeur d'une colonne se calcule à partir de l'écart, que `passeEcarts`
 * publie dans une variable CSS — les variables sont acquises depuis Chrome 49.
 * Elle est réinitialisée sur chaque conteneur pour qu'une grille imbriquée
 * sans écart n'hérite pas de celui de son parent.
 *
 * S'exécute AVANT `passeEcarts` : celle-ci convertit `gap` en marges, et le
 * calcul de largeur doit être écrit tant que la relation est encore lisible.
 */
export function passeGrille(racine: Root, contexte: ContexteCompat): void {
  let grilleRencontree = false;

  racine.walkDecls((declaration) => {
    // `display: grid` → flexbox à retour à la ligne. Le `flex-wrap` est
    // indispensable : une grille passe à la ligne, une flexbox non.
    if (declaration.prop === "display" && (declaration.value === "grid" || declaration.value === "inline-grid")) {
      declaration.value = declaration.value === "grid" ? "flex" : "inline-flex";
      declaration.parent?.append(creerDeclaration({ prop: "flex-wrap", value: "wrap" }));
      grilleRencontree = true;
      contexte.compter("grilles");
      return;
    }

    if (declaration.prop === "grid-template-columns") {
      convertirColonnes(declaration.value, declaration, contexte);
      return;
    }

    // `col-span-*` et `row-span-*` : sans grille, un élément ne peut plus
    // couvrir plusieurs pistes. Il retombe à une colonne, ce qui est lisible —
    // là où la déclaration conservée invaliderait la règle.
    if (declaration.prop === "grid-column" || declaration.prop === "grid-row") {
      declaration.remove();
      contexte.compter("portees-abandonnees");
    }
  });

  if (grilleRencontree) {
    // Posée en tête de feuille, donc avant les règles d'écart qui la
    // redéfinissent : sans elle, un conteneur sans écart imbriqué dans un
    // conteneur qui en a hériterait le sien et décalerait ses colonnes.
    // `.grid` en fait partie — la classe subsiste, seul son `display` a changé.
    const reinitialisation = creerRegle({
      selectors: [".flex", ".inline-flex", ".grid", ".inline-grid"],
    });
    reinitialisation.append(creerDeclaration({ prop: VARIABLE_ECART, value: "0px" }));
    racine.prepend(reinitialisation);
  }
}

/**
 * `repeat(N, minmax(0, 1fr))` → une largeur par enfant direct.
 *
 * `calc(100/N% - écart)` est exact et non approché : le conteneur porte une
 * marge négative d'un demi-écart de chaque côté, sa largeur de contenu vaut
 * donc W + écart, et chaque enfant occupe cette largeur divisée par N, moins
 * ses propres marges.
 */
function convertirColonnes(
  valeur: string,
  declaration: { parent?: unknown; remove(): void },
  contexte: ContexteCompat,
): void {
  const correspondance = /^repeat\(\s*(\d+)\s*,/.exec(valeur.trim());
  const parent = declaration.parent as { selector?: string; after?(noeud: unknown): void } | undefined;

  if (!correspondance || !parent?.selector) {
    // Forme non reconnue : la retirer quand même, sinon la règle entière est
    // invalidée. Le compteur la signale, elle mérite un regard.
    declaration.remove();
    contexte.compter("colonnes-non-reconnues");
    return;
  }

  const colonnes = Number(correspondance[1]);
  const largeur = `calc(${(100 / colonnes).toFixed(4)}% - var(${VARIABLE_ECART}, 0px))`;

  const regleEnfants = creerRegle({
    selectors: parent.selector.split(",").map((selecteur) => `${selecteur.trim()} > *`),
  });
  regleEnfants.append(creerDeclaration({ prop: "width", value: largeur }));
  // Sans cela un enfant en `flex: 1` s'étirerait et ignorerait la largeur.
  regleEnfants.append(creerDeclaration({ prop: "flex", value: "0 0 auto" }));

  parent.after?.(regleEnfants);
  declaration.remove();
  contexte.compter("colonnes");
}
