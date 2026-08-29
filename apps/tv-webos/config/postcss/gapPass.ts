import { rule as createRule, decl as createDecl, type Root, type Rule } from "postcss";
import { GAP_VARIABLE } from "./gridPass";
import type { CompatContext } from "./context";

/** Conteneurs auxquels un écart s'applique, une fois les grilles converties. */
const CONTAINERS = [".flex", ".inline-flex", ".grid", ".inline-grid"];

/**
 * Remplace `gap` par des marges.
 *
 * `gap` en flexbox n'arrive qu'avec Chrome 84, alors qu'il est acquis en
 * grille depuis Chrome 66. C'est l'écart le plus coûteux du portage : plus de
 * trois cents conteneurs du dépôt en dépendent, et sans lui tous les
 * espacements de rangée, de barre d'outils et de formulaire disparaissent
 * d'un coup.
 *
 * La conversion est mécanique parce que Tailwind marque explicitement ses
 * conteneurs : `.flex`, `.inline-flex`, `.grid`. On compose donc la classe
 * d'écart avec chacune d'elles plutôt que d'appliquer la marge à tout élément
 * qui porte un `gap` — ce qui produirait des marges parasites sur les
 * conteneurs en bloc, où `gap` ne faisait rien.
 *
 * **Limite assumée** : `.flex.gap-4 > *` l'emporte sur une marge posée
 * directement sur l'enfant. Un `mb-4` sur un enfant direct d'un conteneur à
 * écart est donc écrasé. C'est le compromis de tous les polyfills d'écart ;
 * l'alternative — abaisser la spécificité — rendrait le résultat dépendant de
 * l'ordre des utilitaires dans la feuille, donc imprévisible.
 */
export function gapPass(root: Root, context: CompatContext): void {
  root.walkRules((rule) => {
    const gaps = readGaps(rule);
    if (!gaps) return;

    const composed = composeWithContainers(rule.selector);
    if (composed.length === 0) return;

    const horizontal = gaps.column ?? "0px";
    const vertical = gaps.row ?? "0px";

    // Le conteneur : marge négative d'un demi-écart, pour que les marges des
    // enfants ne creusent pas les bords.
    const containerRule = createRule({ selectors: composed });
    containerRule.append(
      createDecl({ prop: "margin", value: `${negativeHalf(vertical)} ${negativeHalf(horizontal)}` }),
    );
    // Publiée pour le calcul de largeur des colonnes converties.
    containerRule.append(createDecl({ prop: GAP_VARIABLE, value: horizontal }));

    const childrenRule = createRule({ selectors: composed.map((selector) => `${selector} > *`) });
    childrenRule.append(
      createDecl({ prop: "margin", value: `${half(vertical)} ${half(horizontal)}` }),
    );

    rule.after(childrenRule);
    rule.after(containerRule);
    context.count("ecarts");
  });
}

interface ReadGaps {
  column?: string;
  row?: string;
}

/** Retire les déclarations d'écart de la règle et rend leurs valeurs. */
function readGaps(rule: Rule): ReadGaps | null {
  let column: string | undefined;
  let row: string | undefined;

  rule.walkDecls((declaration) => {
    if (declaration.prop === "gap") {
      const [premier, second] = declaration.value.trim().split(/\s+/);
      row = premier;
      column = second ?? premier;
      declaration.remove();
    } else if (declaration.prop === "column-gap") {
      column = declaration.value;
      declaration.remove();
    } else if (declaration.prop === "row-gap") {
      row = declaration.value;
      declaration.remove();
    }
  });

  if (column === undefined && row === undefined) return null;
  return { column, row };
}

/**
 * `.gap-4` → `.flex.gap-4`, `.grid.gap-4`, …
 *
 * Les sélecteurs déjà composés — un `gap` posé sur une classe applicative
 * plutôt que sur un utilitaire — sont laissés tels quels : on ne sait pas
 * quel display les accompagne, et deviner produirait un faux positif.
 */
function composeWithContainers(selector: string): string[] {
  const compounds: string[] = [];

  for (const part of selector.split(",")) {
    const simple = part.trim();
    if (simple.length === 0) continue;
    if (CONTAINERS.some((container) => simple.includes(container))) {
      compounds.push(simple);
      continue;
    }
    // Composer suppose un sélecteur d'une seule classe : « .flex » + « .gap-4 »
    // désigne bien le même élément, « .flex » + « .a > .b » désignerait
    // n'importe quoi. Un combinateur ou un descendant est donc laissé tel quel.
    if (!/^\.[^\s>+~]+$/.test(simple)) {
      compounds.push(simple);
      continue;
    }
    for (const container of CONTAINERS) compounds.push(`${container}${simple}`);
  }

  return compounds;
}

function half(value: string): string {
  return `calc(${value} / 2)`;
}

function negativeHalf(value: string): string {
  return `calc(${value} / -2)`;
}
