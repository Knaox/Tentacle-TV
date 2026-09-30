/**
 * L'ORDRE choisi des entrées du rail — module pur : l'état arrive en argument,
 * les tests n'ont besoin ni de React ni de stockage.
 *
 * Même sémantique que la barre du bureau (`navLayout.ts` du web) :
 * - un ordre VIDE veut dire « l'ordre par défaut » — rien à régler pour que
 *   le rail serve, et une installation qui n'a jamais rien déplacé garde la
 *   forme de stockage d'avant ;
 * - une entrée que l'ordre ne connaît pas (une bibliothèque créée depuis) se
 *   range à la suite, dans son ordre par défaut ;
 * - une clé qui ne correspond plus à rien s'ignore.
 *
 * L'ordre porte sur TOUTES les entrées déplaçables, masquées comprises : une
 * entrée qu'on ré-affiche retrouve la place qu'on lui avait donnée. Un
 * déplacement d'un cran, lui, se compte parmi les entrées VISIBLES — c'est
 * ce que l'utilisateur voit bouger.
 */

/** Range les éléments dans l'ordre choisi ; les inconnus suivent, dans leur ordre par défaut. */
export function applyRailOrder<T>(items: readonly T[], order: readonly string[], keyOf: (item: T) => string): T[] {
  if (order.length === 0) return [...items];
  const rank = new Map<string, number>();
  order.forEach((key, index) => {
    if (!rank.has(key)) rank.set(key, index);
  });
  const known = items.filter((item) => rank.has(keyOf(item)));
  known.sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0));
  return [...known, ...items.filter((item) => !rank.has(keyOf(item)))];
}

/**
 * Pose `key` de l'autre côté de `target` : juste après elle quand elle
 * descend, juste avant quand elle monte. Rend un nouvel ordre ; une clé
 * absente, ou la même des deux côtés, ne change rien.
 */
export function moveRailKeyTo(keys: readonly string[], key: string, target: string): string[] {
  const from = keys.indexOf(key);
  const at = keys.indexOf(target);
  if (from < 0 || at < 0 || from === at) return [...keys];
  const rest = keys.filter((other) => other !== key);
  const targetIndex = rest.indexOf(target);
  rest.splice(from < at ? targetIndex + 1 : targetIndex, 0, key);
  return rest;
}

/**
 * Monte (−1) ou descend (+1) `key` d'un cran parmi les entrées visibles : elle
 * passe de l'autre côté de sa voisine VISIBLE, les masquées qui les séparent
 * restant en place. Aux bords, rien ne bouge.
 */
export function moveRailKey(
  keys: readonly string[],
  key: string,
  delta: -1 | 1,
  isVisible: (key: string) => boolean = () => true,
): string[] {
  const from = keys.indexOf(key);
  if (from < 0) return [...keys];
  let to = from + delta;
  while (to >= 0 && to < keys.length && !isVisible(keys[to])) to += delta;
  if (to < 0 || to >= keys.length) return [...keys];
  return moveRailKeyTo(keys, key, keys[to]);
}

/** Deux ordres identiques, clé pour clé. */
export function sameRailOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}
