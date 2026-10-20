/**
 * Le titre qu'un toucher sur le suivi en direct vient montrer (`?item=` de
 * « Sur cet appareil ») passe EN TÊTE des transferts en cours : la section
 * « En cours » est la première sous la synthèse, il est donc en vue dès
 * l'ouverture. Les autres gardent leur ordre.
 */

export function focusFirst<T extends { itemId: string }>(entries: readonly T[], itemId: string | null | undefined): T[] {
  if (!itemId) return [...entries];
  const focused = entries.filter((entry) => entry.itemId === itemId);
  if (focused.length === 0) return [...entries];
  return [...focused, ...entries.filter((entry) => entry.itemId !== itemId)];
}
