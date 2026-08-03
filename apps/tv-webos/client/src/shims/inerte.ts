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
