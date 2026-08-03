import type { Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/**
 * Ramène les pseudo-classes récentes à ce que Chrome 53 sait lire.
 *
 * Un sélecteur inconnu n'est pas ignoré : il invalide la règle **entière**.
 * Deux conséquences, invisibles depuis les sources parce que ce CSS est
 * produit par Tailwind et n'existe nulle part dans le dépôt :
 *
 *   - `button, input:where([type=button]), …{background-color:transparent}`
 *     est la règle du preflight qui neutralise le fond natif des boutons. Sans
 *     elle, chaque bouton de l'application reprend le dégradé gris du moteur.
 *   - `[hidden]:where(:not([hidden=until-found])){display:none}` est ce qui
 *     fait que l'attribut `hidden` cache quelque chose.
 *
 * `:focus-visible` devient `:focus`, sans polyfill. Sur un téléviseur il n'y a
 * ni souris ni doigt : les deux sont sémantiquement identiques. Un polyfill
 * décide de la « modalité » d'après le dernier événement d'entrée, et
 * classerait « programmatique » le cas qui compte le plus ici — la remise au
 * point du focus après qu'un défilement a monté de nouvelles cartes, qui se
 * produit dans un rappel d'observateur, hors de tout événement clavier. Il
 * retirerait l'anneau exactement quand l'utilisateur en a le plus besoin.
 *
 * Passe exécutée avant toute transformation géométrique : elle réécrit des
 * sélecteurs, et les passes suivantes clonent des règles.
 */
export function passePseudoModernes(racine: Root, contexte: ContexteCompat): void {
  racine.walkRules((regle) => {
    const origine = regle.selector;
    let selecteur = origine;

    if (selecteur.includes(":focus-visible")) {
      selecteur = selecteur.replace(/:focus-visible/g, ":focus");
      contexte.compter("focus-visible");
    }

    if (selecteur.includes(":where(") || selecteur.includes(":is(")) {
      const deplie = deplierEnveloppes(selecteur);
      if (deplie !== selecteur) {
        selecteur = deplie;
        contexte.compter("pseudo-fonctionnelles");
      }
    }

    if (selecteur !== origine) regle.selector = selecteur;
  });
}

/**
 * Retire les enveloppes `:where(…)` et `:is(…)` en conservant leur contenu.
 *
 * La spécificité change — `:where()` la met à zéro — mais aucune des cinq
 * règles concernées ne s'appuie sur cette propriété : ce sont des règles de
 * preflight, seules à cibler ce qu'elles ciblent.
 *
 * Une enveloppe contenant une virgule au premier niveau demanderait d'éclater
 * le sélecteur en plusieurs ; le cas ne se présente pas dans ce qu'émet
 * Tailwind 3, et la laisser intacte vaut mieux qu'une réécriture approximative
 * — `gardeCompat` la signalera en fin de build.
 */
function deplierEnveloppes(selecteur: string): string {
  let resultat = selecteur;

  for (const enveloppe of [":where(", ":is("]) {
    let debut = resultat.indexOf(enveloppe);
    while (debut !== -1) {
      const ouvrante = debut + enveloppe.length - 1;
      const fermante = trouverFermante(resultat, ouvrante);
      if (fermante === -1) break;

      const contenu = resultat.slice(ouvrante + 1, fermante);
      if (contenu.includes(",")) {
        debut = resultat.indexOf(enveloppe, debut + 1);
        continue;
      }

      resultat = resultat.slice(0, debut) + contenu + resultat.slice(fermante + 1);
      debut = resultat.indexOf(enveloppe);
    }
  }

  return resultat;
}

/** Index de la parenthèse fermante appariée, ou -1. */
function trouverFermante(texte: string, ouvrante: number): number {
  let profondeur = 0;
  for (let i = ouvrante; i < texte.length; i++) {
    if (texte[i] === "(") profondeur++;
    else if (texte[i] === ")") {
      profondeur--;
      if (profondeur === 0) return i;
    }
  }
  return -1;
}
