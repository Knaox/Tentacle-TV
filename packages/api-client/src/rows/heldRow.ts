import { useMemo, useState } from "react";

/**
 * Une rangée TENUE ne bouge pas sous le curseur — LA règle de toutes les
 * rangées de cartes (accueil, recommandations) : tant qu'on la survole (web,
 * bureau), elle garde les cartes de sa photographie, prise au premier instant
 * du survol. Un geste de carte qui la retirerait de la rangée (« vu » dans
 * Reprendre, le cœur décoché dans Mes favoris, Ma liste retirée…) ne la fait
 * partir qu'au LÂCHER — le survol fini, la rangée suit ses données. Rien ne
 * glisse sous le pointeur : la voisine resterait sinon sous le curseur, et un
 * second clic tomberait sur elle.
 *
 * Les cartes gardées se rendent avec leur DERNIÈRE version quand la liste
 * l'a encore (progression, marqueurs) ; une carte qu'elle a perdue garde
 * celle de la photographie. Ce qui arrive pendant le survol attend le lâcher.
 * `drop` : ce qui part quand même tout de suite (« Ne plus me proposer »).
 */
export function heldRowView<T>(
  items: readonly T[],
  frozen: readonly T[] | null,
  held: boolean,
  keyOf: (item: T) => string,
  drop?: (item: T) => boolean,
): readonly T[] {
  if (!held) return items;
  const source = frozen ?? items;
  const latest = new Map<string, T>();
  for (const item of items) if (!latest.has(keyOf(item))) latest.set(keyOf(item), item);
  return source.filter((item) => !drop?.(item)).map((item) => latest.get(keyOf(item)) ?? item);
}

/** La photographie de la rangée tant qu'elle est tenue ; `null` sinon. */
export function useRowSnapshot<T>(items: readonly T[], held: boolean): readonly T[] | null {
  const [frozen, setFrozen] = useState<readonly T[] | null>(null);
  // État dérivé des props, posé pendant le rendu (motif documenté de React) :
  // la photographie est celle du rendu où le survol commence.
  if (held && frozen === null) setFrozen(items);
  else if (!held && frozen !== null) setFrozen(null);
  return held ? (frozen ?? items) : null;
}

/** Les cartes à rendre d'une rangée, tenue (`held`) ou non. `keyOf` : stable (hors du rendu). */
export function useHeldRowItems<T>(items: readonly T[], held: boolean, keyOf: (item: T) => string): readonly T[] {
  const frozen = useRowSnapshot(items, held);
  return useMemo(() => heldRowView(items, frozen, held, keyOf), [items, frozen, held, keyOf]);
}
