/**
 * L'état de SÉANCE du retrait des recommandations (cf. recoRetirement.ts) —
 * trois ensembles, sans dépendance : `useRecoPage` le lit dans son `select`
 * sans créer de cycle d'import.
 *
 *   • les cartes TENUES : survolées (leur rangée, sur le web) ou dont la
 *     feuille d'actions est ouverte (mobile, miroir, TV) — un compteur par
 *     carte, la rangée et la feuille peuvent la tenir ensemble ;
 *   • les titres RETIRÉS : jugés (Ma liste, cœur, vu, note) puis lâchés —
 *     aucune page servie ensuite ne les remontre ;
 *   • les titres ÉCARTÉS (« Ne plus me proposer ») : eux partent TOUT DE
 *     SUITE, même d'une rangée tenue.
 *
 * Une carte se désigne par la clé du titre (« movie:603 ») ou par son item
 * Jellyfin — la carte d'une télévision ne connaît que lui.
 */

const holds = new Map<string, number>();
const retired = new Set<string>();
const dismissed = new Set<string>();

export function holdRecoCard(id: string): void {
  holds.set(id, (holds.get(id) ?? 0) + 1);
}

/** Relâche une prise ; vrai quand la carte n'est plus tenue du tout. */
export function unholdRecoCard(id: string): boolean {
  const left = (holds.get(id) ?? 0) - 1;
  if (left > 0) {
    holds.set(id, left);
    return false;
  }
  holds.delete(id);
  return true;
}

/** Le titre est-il tenu, par sa clé ou par son item Jellyfin ? */
export function isRecoItemHeld(item: { key: string; jellyfinItemId?: string | null }): boolean {
  return holds.has(item.key) || (!!item.jellyfinItemId && holds.has(item.jellyfinItemId));
}

export function markRecoRetired(key: string): void {
  retired.add(key);
}

export function isRecoRetired(key: string): boolean {
  return retired.has(key);
}

export function hasRetiredReco(): boolean {
  return retired.size > 0;
}

export function markRecoDismissed(key: string): void {
  dismissed.add(key);
}

export function isRecoDismissed(key: string): boolean {
  return dismissed.has(key);
}

/** Isolation des tests. */
export function resetRecoRetirementForTests(): void {
  holds.clear();
  retired.clear();
  dismissed.clear();
}
