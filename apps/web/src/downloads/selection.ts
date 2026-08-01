/**
 * Logique du mode sélection des téléchargements.
 *
 * Séparée du composant parce qu'elle porte les seuls invariants qui peuvent
 * mordre : une sélection qui garde des identifiants disparus, et un « tout
 * sélectionner » qui ne dit pas la même chose que la case à cocher d'en-tête.
 *
 * Les deux se produisent pour de vrai : la liste se rafraîchit toute seule à
 * chaque évènement `downloads://changed`, et un transfert qui se termine ou une
 * purge différée peuvent faire disparaître une ligne cochée sous les doigts de
 * l'utilisateur.
 */

/** Ce qu'une sélection peut valoir vis-à-vis de la liste affichée. */
export type EtatSelection = "aucune" | "partielle" | "totale";

/**
 * Retire de la sélection ce qui n'est plus dans la liste.
 *
 * Sans ce nettoyage, une suppression en masse porterait sur des identifiants
 * fantômes — sans dommage côté moteur, qui les ignore, mais le compteur
 * annoncerait « 5 éléments » là où trois seulement partiraient.
 */
export function elaguer(selection: ReadonlySet<number>, presents: readonly number[]): Set<number> {
  const vivants = new Set(presents);
  const sortie = new Set<number>();
  for (const id of selection) if (vivants.has(id)) sortie.add(id);
  return sortie;
}

export function basculer(selection: ReadonlySet<number>, id: number): Set<number> {
  const sortie = new Set(selection);
  if (sortie.has(id)) sortie.delete(id);
  else sortie.add(id);
  return sortie;
}

/**
 * État de la sélection face à la liste.
 *
 * Une liste VIDE vaut `aucune` et jamais `totale` : proposer « tout
 * désélectionner » sur rien du tout n'a pas de sens, et la case d'en-tête
 * apparaîtrait cochée sans qu'aucun élément ne le soit.
 */
export function etat(selection: ReadonlySet<number>, presents: readonly number[]): EtatSelection {
  if (presents.length === 0 || selection.size === 0) return "aucune";
  const retenus = presents.filter((id) => selection.has(id)).length;
  if (retenus === 0) return "aucune";
  return retenus === presents.length ? "totale" : "partielle";
}

/**
 * Bascule « tout sélectionner ».
 *
 * Tout sauf totale → on prend tout ; totale → on vide. Une sélection PARTIELLE
 * se complète donc au lieu de se vider : c'est ce que fait tout gestionnaire de
 * fichiers, et c'est le geste attendu quand on a coché trois lignes puis changé
 * d'avis sur l'ampleur.
 */
export function toutBasculer(
  selection: ReadonlySet<number>,
  presents: readonly number[],
): Set<number> {
  return etat(selection, presents) === "totale" ? new Set() : new Set(presents);
}
