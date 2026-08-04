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
 *
 * **Deux règles et non une** : les enfants sortent tous du flux, mais seul le
 * premier remplit la boîte. Le détail est au point d'émission — c'est là que la
 * distinction se comprend.
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

    // Tous les enfants sortent du flux — la boîte a une hauteur nulle, un enfant
    // resté dans le flux déborderait par le bas.
    const regleEnfants = creerRegle({
      selectors: parent.selector.split(",").map((selecteur) => `${selecteur.trim()} > *`),
    });
    regleEnfants.append(creerDeclaration({ prop: "position", value: "absolute" }));

    // Mais SEUL le premier remplit la boîte.
    //
    // Poser les quatre côtés sur `> *` retournait la carte. La règle est écrite
    // après les classes utilitaires de Tailwind, à spécificité égale : elle les
    // battait toutes. Un enfant marqué `bottom-0 h-1/2` — le dégradé de
    // lisibilité d'une vignette 16:9 — recevait `top: 0`, se retrouvait
    // sur-contraint (`top` + `bottom` + `height`), et CSS tranche alors en
    // ignorant `bottom` : le dégradé se dessinait sur la moitié HAUTE, sa part
    // la plus dense au milieu de l'image. Mesuré sur une vignette de 173 px, le
    // libellé d'épisode et la barre de progression remontaient avec lui.
    //
    // Le premier enfant est le contenu dans les vingt-quatre usages `aspect-*`
    // du dépôt — image, affiche, ou son substitut quand elle manque. Les frères
    // portent tous leur propre `absolute` et leurs propres décalages : il suffit
    // de cesser de les écraser.
    const regleContenu = creerRegle({
      selectors: parent.selector.split(",").map((selecteur) => `${selecteur.trim()} > :first-child`),
    });
    regleContenu.append(creerDeclaration({ prop: "top", value: "0" }));
    regleContenu.append(creerDeclaration({ prop: "right", value: "0" }));
    regleContenu.append(creerDeclaration({ prop: "bottom", value: "0" }));
    regleContenu.append(creerDeclaration({ prop: "left", value: "0" }));

    // Un élément REMPLACÉ ne peut pas être traité ainsi.
    //
    // `height: 0` avec `padding-top` donne bien la bonne boîte, mais la boîte de
    // CONTENU reste haute de zéro — et c'est elle qui porte le pixel d'un
    // `<img>`. Mesuré sur l'affiche de la fiche : 336 px de padding pour 0 de
    // contenu, donc une image jamais peinte, un rectangle vide à la place de
    // l'affiche. Le défaut ne se voit pas au build : la boîte a la bonne taille.
    //
    // `height: auto` rend la main au rapport intrinsèque du fichier, qui est
    // déjà le bon dans le seul cas du dépôt (`DetailPoster.tsx:107`, la seule
    // balise remplacée à porter une classe de ratio). On y perd le recadrage
    // d'`object-cover` si jamais l'image reçue s'écartait du rapport annoncé —
    // c'est très peu cher payé pour une affiche qui s'affiche.
    const regleRemplaces = creerRegle({
      selectors: parent.selector
        .split(",")
        .flatMap((selecteur) => [`img${selecteur.trim()}`, `video${selecteur.trim()}`]),
    });
    regleRemplaces.append(creerDeclaration({ prop: "height", value: "auto" }));
    regleRemplaces.append(creerDeclaration({ prop: "padding-top", value: "0" }));

    parent.after?.(regleRemplaces);
    parent.after?.(regleContenu);
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
