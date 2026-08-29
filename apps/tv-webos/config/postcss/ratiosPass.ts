import { rule as createRule, decl as createDecl, type Root } from "postcss";
import type { CompatContext } from "./context";

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
 * report voulu. Le contenu est alors sorti du flux et calé sur la boîte.
 *
 * **Limite de la technique** : un pourcentage de `padding` se rapporte à la
 * largeur du bloc conteneur, pas à celle de l'élément. Le report n'est donc
 * exact que pour un élément qui occupe toute la largeur de son parent — ce qui
 * est le cas de tous les usages du dépôt, où `aspect-*` habille une boîte
 * image en pleine largeur de carte. Un élément à ratio dont la largeur serait
 * fixée en dur, elle, serait trop haut.
 *
 * **Deux règles et non une** : les enfants sortent tous du flux, mais seul le
 * premier remplit la boîte. Le détail est au point d'émission — c'est là que la
 * distinction se comprend.
 */
export function ratiosPass(root: Root, context: CompatContext): void {
  root.walkDecls("aspect-ratio", (declaration) => {
    const parent = declaration.parent as { selector?: string; after?(node: unknown): void } | undefined;
    const report = readReport(declaration.value);

    if (!report || !parent?.selector) {
      declaration.remove();
      context.count("ratios-non-reconnus");
      return;
    }

    const container = declaration.parent;
    if (container && "append" in container) {
      const block = container as { append(...nodes: unknown[]): void };
      block.append(createDecl({ prop: "position", value: "relative" }));
      block.append(createDecl({ prop: "height", value: "0" }));
      block.append(
        createDecl({ prop: "padding-top", value: `${(report * 100).toFixed(4)}%` }),
      );
      // La pleine largeur, qui était SUPPOSÉE et jamais assurée.
      //
      // La technique s'appuie sur un `padding` en pourcentage, qui se rapporte à
      // la largeur du bloc conteneur : elle n'a de sens que pour une boîte qui
      // occupe toute la largeur de son parent. C'était vrai partout, jusqu'à ce
      // qu'un parent cesse d'étirer ses enfants.
      //
      // Le cas mesuré est la vignette d'un extra : son bouton est
      // `flex flex-col` avec `align-items: flex-start`, donc la boîte n'est pas
      // étirée et se dimensionne sur son contenu — or la règle `> *` ci-dessous
      // vient justement de sortir TOUT son contenu du flux. Largeur zéro, image
      // en `object-fit: cover` sur zéro pixel, et un rectangle noir à la place
      // de la bande-annonce. La hauteur, elle, restait juste : le pourcentage se
      // rapporte au PARENT, pas à l'élément — d'où une boîte visiblement haute
      // et invisiblement plate.
      //
      // `align-self` plutôt que `width: 100%` : il ne s'applique qu'à un enfant
      // de flex ou de grille, ne dispute rien aux utilitaires de largeur de
      // Tailwind, et cède de lui-même dès qu'une largeur explicite est posée.
      block.append(createDecl({ prop: "align-self", value: "stretch" }));
    }

    // Tous les enfants sortent du flux — la boîte a une hauteur nulle, un enfant
    // resté dans le flux déborderait par le bas.
    const childrenRule = createRule({
      selectors: parent.selector.split(",").map((selector) => `${selector.trim()} > *`),
    });
    childrenRule.append(createDecl({ prop: "position", value: "absolute" }));

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
    const contentRule = createRule({
      selectors: parent.selector.split(",").map((selector) => `${selector.trim()} > :first-child`),
    });
    contentRule.append(createDecl({ prop: "top", value: "0" }));
    contentRule.append(createDecl({ prop: "right", value: "0" }));
    contentRule.append(createDecl({ prop: "bottom", value: "0" }));
    contentRule.append(createDecl({ prop: "left", value: "0" }));

    // Un élément REMPLACÉ ne peut pas être traité ainsi.
    //
    // `height: 0` avec `padding-top` donne bien la bonne boîte, mais la boîte de
    // CONTENU reste haute de zéro — et c'est elle qui porte le pixel d'un
    // `<img>`. Mesuré sur l'affiche de la fiche : 336 px de padding pour 0 de
    // contenu, donc une image jamais peinte, un rectangle vide à la place de
    // l'affiche. Le défaut ne se voit pas au build : la boîte a la bonne taille.
    //
    // `height: auto` rend la main au report intrinsèque du fichier, qui est
    // déjà le bon dans le seul cas du dépôt (`DetailPoster.tsx:107`, la seule
    // balise remplacée à porter une classe de ratio). On y perd le recadrage
    // d'`object-cover` si jamais l'image reçue s'écartait du report annoncé —
    // c'est très peu cher payé pour une affiche qui s'affiche.
    const replacedRule = createRule({
      selectors: parent.selector
        .split(",")
        .flatMap((selector) => [`img${selector.trim()}`, `video${selector.trim()}`]),
    });
    replacedRule.append(createDecl({ prop: "height", value: "auto" }));
    replacedRule.append(createDecl({ prop: "padding-top", value: "0" }));

    parent.after?.(replacedRule);
    parent.after?.(contentRule);
    parent.after?.(childrenRule);
    declaration.remove();
    context.count("ratios");
  });
}

/** « 2 / 3 » → 1.5 (hauteur rapportée à la largeur). */
function readReport(value: string): number | null {
  const clean = value.trim();
  const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(clean);
  if (fraction) {
    const width = Number(fraction[1]);
    const height = Number(fraction[2]);
    return width > 0 ? height / width : null;
  }
  const number = Number(clean);
  return Number.isFinite(number) && number > 0 ? 1 / number : null;
}
