import { rule as creerRegle, decl as creerDeclaration, type Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/**
 * Remplace `aspect-ratio` par la boîte à remplissage proportionnel.
 *
 * `aspect-ratio` n'arrive qu'avec Chrome 88. Le compte est trompeur — quatre
 * règles dans la feuille finale — mais ces quatre règles portent la boîte
 * image de `CardFrame`, donc celle de toutes les affiches, de toutes les
 * vignettes d'épisode et de tous les squelettes de chargement. Sans elles, la
 * hauteur vaut zéro et l'accueil est une pile de rangées vides.
 *
 * La technique est celle qui précède la propriété : une hauteur nulle et un
 * `padding-top` exprimé en pourcentage de la **largeur**, ce qui donne le
 * rapport voulu. Le contenu est alors sorti du flux et calé sur la boîte.
 *
 * **Limite de la technique** : un pourcentage de `padding` se rapporte à la
 * largeur du bloc conteneur, pas à celle de l'élément. Le rapport n'est donc
 * exact que pour un élément qui occupe toute la largeur de son parent — ce qui
 * est le cas de tous les usages du dépôt, où `aspect-*` habille une boîte
 * image en pleine largeur de carte. Un élément à ratio dont la largeur serait
 * fixée en dur, elle, serait trop haut.
 */
export function passeRatios(racine: Root, contexte: ContexteCompat): void {
  racine.walkDecls("aspect-ratio", (declaration) => {
    const parent = declaration.parent as { selector?: string; after?(noeud: unknown): void } | undefined;
    const rapport = lireRapport(declaration.value);

    if (!rapport || !parent?.selector) {
      declaration.remove();
      contexte.compter("ratios-non-reconnus");
      return;
    }

    const conteneur = declaration.parent;
    if (conteneur && "append" in conteneur) {
      const bloc = conteneur as { append(...noeuds: unknown[]): void };
      bloc.append(creerDeclaration({ prop: "position", value: "relative" }));
      bloc.append(creerDeclaration({ prop: "height", value: "0" }));
      bloc.append(
        creerDeclaration({ prop: "padding-top", value: `${(rapport * 100).toFixed(4)}%` }),
      );
    }

    // Le contenu doit remplir la boîte : sans cela il se rendrait dans une
    // zone de hauteur nulle et resterait invisible.
    const regleEnfants = creerRegle({
      selectors: parent.selector.split(",").map((selecteur) => `${selecteur.trim()} > *`),
    });
    regleEnfants.append(creerDeclaration({ prop: "position", value: "absolute" }));
    regleEnfants.append(creerDeclaration({ prop: "top", value: "0" }));
    regleEnfants.append(creerDeclaration({ prop: "right", value: "0" }));
    regleEnfants.append(creerDeclaration({ prop: "bottom", value: "0" }));
    regleEnfants.append(creerDeclaration({ prop: "left", value: "0" }));

    parent.after?.(regleEnfants);
    declaration.remove();
    contexte.compter("ratios");
  });
}

/** « 2 / 3 » → 1.5 (hauteur rapportée à la largeur). */
function lireRapport(valeur: string): number | null {
  const propre = valeur.trim();
  const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(propre);
  if (fraction) {
    const largeur = Number(fraction[1]);
    const hauteur = Number(fraction[2]);
    return largeur > 0 ? hauteur / largeur : null;
  }
  const nombre = Number(propre);
  return Number.isFinite(nombre) && nombre > 0 ? 1 / nombre : null;
}
