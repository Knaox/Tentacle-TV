import { rule as creerRegle, decl as creerDeclaration, type Root, type Rule } from "postcss";
import { VARIABLE_ECART } from "./passeGrille";
import type { ContexteCompat } from "./contexte";

/** Conteneurs auxquels un écart s'applique, une fois les grilles converties. */
const CONTENEURS = [".flex", ".inline-flex", ".grid", ".inline-grid"];

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
export function passeEcarts(racine: Root, contexte: ContexteCompat): void {
  racine.walkRules((regle) => {
    const ecarts = releverEcarts(regle);
    if (!ecarts) return;

    const compose = composerAvecConteneurs(regle.selector);
    if (compose.length === 0) return;

    const horizontal = ecarts.colonne ?? "0px";
    const vertical = ecarts.rangee ?? "0px";

    // Le conteneur : marge négative d'un demi-écart, pour que les marges des
    // enfants ne creusent pas les bords.
    const regleConteneur = creerRegle({ selectors: compose });
    regleConteneur.append(
      creerDeclaration({ prop: "margin", value: `${moitieNegative(vertical)} ${moitieNegative(horizontal)}` }),
    );
    // Publiée pour le calcul de largeur des colonnes converties.
    regleConteneur.append(creerDeclaration({ prop: VARIABLE_ECART, value: horizontal }));

    const regleEnfants = creerRegle({ selectors: compose.map((selecteur) => `${selecteur} > *`) });
    regleEnfants.append(
      creerDeclaration({ prop: "margin", value: `${moitie(vertical)} ${moitie(horizontal)}` }),
    );

    regle.after(regleEnfants);
    regle.after(regleConteneur);
    contexte.compter("ecarts");
  });
}

interface EcartsReleves {
  colonne?: string;
  rangee?: string;
}

/** Retire les déclarations d'écart de la règle et rend leurs valeurs. */
function releverEcarts(regle: Rule): EcartsReleves | null {
  let colonne: string | undefined;
  let rangee: string | undefined;

  regle.walkDecls((declaration) => {
    if (declaration.prop === "gap") {
      const [premier, second] = declaration.value.trim().split(/\s+/);
      rangee = premier;
      colonne = second ?? premier;
      declaration.remove();
    } else if (declaration.prop === "column-gap") {
      colonne = declaration.value;
      declaration.remove();
    } else if (declaration.prop === "row-gap") {
      rangee = declaration.value;
      declaration.remove();
    }
  });

  if (colonne === undefined && rangee === undefined) return null;
  return { colonne, rangee };
}

/**
 * `.gap-4` → `.flex.gap-4`, `.grid.gap-4`, …
 *
 * Les sélecteurs déjà composés — un `gap` posé sur une classe applicative
 * plutôt que sur un utilitaire — sont laissés tels quels : on ne sait pas
 * quel display les accompagne, et deviner produirait un faux positif.
 */
function composerAvecConteneurs(selecteur: string): string[] {
  const composes: string[] = [];

  for (const partie of selecteur.split(",")) {
    const simple = partie.trim();
    if (simple.length === 0) continue;
    if (CONTENEURS.some((conteneur) => simple.includes(conteneur))) {
      composes.push(simple);
      continue;
    }
    // Composer suppose un sélecteur d'une seule classe : « .flex » + « .gap-4 »
    // désigne bien le même élément, « .flex » + « .a > .b » désignerait
    // n'importe quoi. Un combinateur ou un descendant est donc laissé tel quel.
    if (!/^\.[^\s>+~]+$/.test(simple)) {
      composes.push(simple);
      continue;
    }
    for (const conteneur of CONTENEURS) composes.push(`${conteneur}${simple}`);
  }

  return composes;
}

function moitie(valeur: string): string {
  return `calc(${valeur} / 2)`;
}

function moitieNegative(valeur: string): string {
  return `calc(${valeur} / -2)`;
}
