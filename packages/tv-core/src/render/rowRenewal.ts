/**
 * Le RENOUVELLEMENT échelonné d'une rangée dont la liste change entière (les
 * résultats d'une frappe), là où le profil de rendu échelonne les rangées
 * (`stagedRows`, Android TV) : ce qui est à l'écran prend la nouvelle liste
 * tout de suite (`initialRelease`), le reste suit une part par image
 * (`nextRelease`, `STAGING_PACE`) — et, en attendant, chaque place garde la
 * carte qu'elle montrait : aucune vue n'est démontée pour rien (les cartes
 * sont clées par leur place, `recycleResultCards`).
 *
 * Mesuré sur la Shield (banc « recherche-frappe », 07/10) : appliquer d'un
 * bloc les ~25 cartes d'une réponse prenait 80 à 115 ms de fil UI dans une
 * seule image (~500 mises à jour de vues natives).
 *
 * Module pur.
 */

/**
 * Ce que la rangée montre : la nouvelle liste `next` jusqu'à `released`, puis
 * ce qu'elle montrait déjà (`shown`) aux places suivantes, dans la limite de
 * la nouvelle longueur. Une place que `shown` n'avait pas attend sa part
 * (elle se montera alors). Tout libéré : `next` lui-même (son identité).
 */
export function renewedItems<T>(next: readonly T[], shown: readonly T[], released: number): readonly T[] {
  if (released >= next.length) return next;
  const length = Math.min(next.length, Math.max(released, shown.length));
  const out: T[] = [];
  for (let i = 0; i < length; i++) out.push(i < released ? next[i] : shown[i]);
  return out;
}
