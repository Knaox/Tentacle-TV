/**
 * Octave mobile — combien de tuiles « Écoutés récemment » montrer : deux rangées
 * PLEINES de `columns` au plus, jamais une tuile seule sur sa rangée (la règle
 * du bureau, qui la tient par sa feuille de style) ; moins d'une rangée : ce
 * qu'il y a. Module pur.
 */
export function quickPicksShown(count: number, columns: number): number {
  const full = Math.min(2, Math.floor(count / columns)) * columns;
  return full > 0 ? full : Math.min(count, columns);
}
