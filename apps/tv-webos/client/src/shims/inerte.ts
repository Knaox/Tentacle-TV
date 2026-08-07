/**
 * Composants montés à la racine du routeur, sans équivalent sur un téléviseur.
 *
 * `App.tsx` les monte inconditionnellement ; ils démarrent le moteur de
 * téléchargement et branchent son flux d'événements. Le stockage d'une dalle
 * ne se prête pas au hors-ligne, et laisser le moteur dans le graphe y
 * embarquerait tout l'arbre des téléchargements.
 *
 * Un même module sert les deux : ils exportent chacun un composant qui rend
 * `null`, et l'export nommé suffit à satisfaire les deux imports.
 */

export function DownloadsEngineBoot(): null {
  return null;
}

export function DownloadsEvents(): null {
  return null;
}

/**
 * Le bouton de téléchargement de la fiche média.
 *
 * Il s'efface déjà de lui-même sans le droit Jellyfin correspondant, mais son
 * import tirait tout l'arbre des téléchargements dans le graphe de la fiche.
 * Le rendre inerte ici le sort du bundle, et supprime au passage la question de
 * savoir ce qu'un bouton de téléchargement ferait sur une dalle.
 */
export function DetailDownloadAction(): null {
  return null;
}

/**
 * Le champ de recherche d'une bibliothèque.
 *
 * Le téléviseur a SA recherche : une surcouche plein écran ouverte depuis le
 * rail (`ui/recherche/EcranRechercheTv.tsx`), qui cherche dans toute la
 * médiathèque et se pilote à la télécommande. Un second champ, posé sous la
 * bannière d'une bibliothèque, faisait double emploi et coûtait cher : c'est
 * l'élément le plus haut-gauche de l'écran, donc celui que le focus rencontre
 * en premier, et webOS ouvre son clavier système dès qu'un `<input>` reçoit le
 * focus. On ouvrait une bibliothèque sur un clavier plein écran que personne
 * n'avait demandé.
 *
 * L'état reste chez `LibraryGrid` : `debounced` y demeure vide, aucun terme ne
 * part au catalogue, et le message de vide continue de dire la bonne chose.
 */
export function LibrarySearchField(): null {
  return null;
}
