import type { Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/**
 * Éteint le survol.
 *
 * Les autres passes de ce répertoire traitent des primitives trop récentes pour
 * Chrome 53. Celle-ci est d'une autre nature : `:hover` est parfaitement compris
 * par le socle, et c'est précisément le problème. Sur un téléviseur, **le focus
 * est la seule sélection**. Une carte qui s'agrandit parce que le pointeur de la
 * Magic Remote l'a effleurée désigne autre chose que l'anneau de focus, et
 * l'utilisateur se retrouve avec deux curseurs qui se contredisent.
 *
 * La feuille produite en portait soixante-dix-neuf, dont dix-sept `group-hover`
 * — aucune n'est écrite à la main : elles viennent des variantes Tailwind
 * d'`apps/web`, qui n'a pas à savoir qu'un téléviseur existe. Les retirer ici
 * est le seul point où l'on peut le faire sans toucher au client web.
 *
 * Un sélecteur peut être une liste : `.a:hover, .b` ne perd que sa première
 * part. On découpe donc sur les virgules de premier niveau, on écarte les parts
 * qui portent `:hover`, et la règle n'est supprimée que s'il n'en reste aucune.
 * Découper naïvement sur `,` casserait `:not(a, b)` et `[titre="x, y"]`.
 *
 * Ce qui n'est PAS traité ici, parce que ce n'est pas du CSS : les gestionnaires
 * `onMouseEnter` du client web, qui pilotent `data-hovered` et le panneau
 * d'aperçu. Ceux-là passent par les substitutions de modules.
 */
export function passeSurvol(racine: Root, contexte: ContexteCompat): void {
  racine.walkRules((regle) => {
    if (!regle.selector.includes(":hover")) return;

    const gardees = decouperListe(regle.selector).filter((part) => !part.includes(":hover"));

    if (gardees.length === 0) {
      regle.remove();
      contexte.compter("survol");
      return;
    }

    regle.selector = gardees.join(", ");
    contexte.compter("survol");
  });
}

/**
 * Ce qui reste de survol après la passe.
 *
 * Rendue plutôt que levée, comme `gardeCompat` : l'appelant décide. Le cas
 * normal est une liste vide — un retour non vide signale un défaut du découpage
 * ci-dessus, pas une régression du client web.
 */
export function survolsSurvivants(racine: Root): string[] {
  const restes: string[] = [];
  racine.walkRules((regle) => {
    if (regle.selector.includes(":hover")) restes.push(regle.selector);
  });
  return restes;
}

/** Découpe une liste de sélecteurs sur ses virgules de premier niveau. */
function decouperListe(selecteur: string): string[] {
  const parts: string[] = [];
  let profondeur = 0;
  let guillemet: string | null = null;
  let debut = 0;

  for (let i = 0; i < selecteur.length; i++) {
    const caractere = selecteur[i];

    if (guillemet) {
      if (caractere === guillemet && selecteur[i - 1] !== "\\") guillemet = null;
      continue;
    }

    if (caractere === '"' || caractere === "'") guillemet = caractere;
    else if (caractere === "(" || caractere === "[") profondeur++;
    else if (caractere === ")" || caractere === "]") profondeur--;
    else if (caractere === "," && profondeur === 0) {
      parts.push(selecteur.slice(debut, i).trim());
      debut = i + 1;
    }
  }

  parts.push(selecteur.slice(debut).trim());
  return parts.filter((part) => part.length > 0);
}
