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
export type SelectionState = "aucune" | "partielle" | "totale";

/**
 * Retire de la sélection ce qui n'est plus dans la liste.
 *
 * Sans ce nettoyage, une suppression en masse porterait sur des identifiants
 * fantômes — sans dommage côté moteur, qui les ignore, mais le compteur
 * annoncerait « 5 éléments » là où trois seulement partiraient.
 */
export function prune(selection: ReadonlySet<number>, present: readonly number[]): Set<number> {
  const alive = new Set(present);
  const out = new Set<number>();
  for (const id of selection) if (alive.has(id)) out.add(id);
  return out;
}

export function toggle(selection: ReadonlySet<number>, id: number): Set<number> {
  const out = new Set(selection);
  if (out.has(id)) out.delete(id);
  else out.add(id);
  return out;
}

/**
 * État de la sélection face à la liste.
 *
 * Une liste VIDE vaut `aucune` et jamais `totale` : proposer « tout
 * désélectionner » sur rien du tout n'a pas de sens, et la case d'en-tête
 * apparaîtrait cochée sans qu'aucun élément ne le soit.
 */
export function state(selection: ReadonlySet<number>, present: readonly number[]): SelectionState {
  if (present.length === 0 || selection.size === 0) return "aucune";
  const kept = present.filter((id) => selection.has(id)).length;
  if (kept === 0) return "aucune";
  return kept === present.length ? "totale" : "partielle";
}

/**
 * Bascule « tout sélectionner ».
 *
 * Tout sauf totale → on prend tout ; totale → on vide. Une sélection PARTIELLE
 * se complète donc au lieu de se vider : c'est ce que fait tout gestionnaire de
 * fichiers, et c'est le geste attendu quand on a coché trois lignes puis changé
 * d'avis sur l'ampleur.
 */
export function toggleAll(
  selection: ReadonlySet<number>,
  present: readonly number[],
): Set<number> {
  return state(selection, present) === "totale" ? new Set() : new Set(present);
}
