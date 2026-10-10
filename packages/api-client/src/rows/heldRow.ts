import { useLayoutEffect, useMemo, useRef, useState } from "react";

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
 * l'a encore (progression, marqueurs) ; une carte qu'elle a perdue garde la
 * dernière version qu'on lui a vue (`lastSeen`), à défaut celle de la
 * photographie. Ce qui arrive pendant le survol attend le lâcher.
 * `drop` : ce qui part quand même tout de suite (« Ne plus me proposer »).
 *
 * Pourquoi `lastSeen` : « vu » dans Reprendre patche la liste (la carte passe
 * à vu tout de suite), puis la liste redemandée au serveur ne la contient
 * plus. Rendue avec la photographie, la carte REDEVENAIT non vue sous le
 * curseur jusqu'au lâcher — le clic semblait n'avoir rien fait.
 */
export function heldRowView<T>(
  items: readonly T[],
  frozen: readonly T[] | null,
  held: boolean,
  keyOf: (item: T) => string,
  drop?: (item: T) => boolean,
  lastSeen?: Pick<ReadonlyMap<string, T>, "get">,
): readonly T[] {
  if (!held) return items;
  const source = frozen ?? items;
  const latest = new Map<string, T>();
  for (const item of items) if (!latest.has(keyOf(item))) latest.set(keyOf(item), item);
  return source
    .filter((item) => !drop?.(item))
    .map((item) => latest.get(keyOf(item)) ?? lastSeen?.get(keyOf(item)) ?? item);
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

/**
 * La dernière version rendue de chaque carte, le temps du survol. Notée APRÈS
 * le rendu (effet) : jamais d'état, donc rien à faire converger. La même Map
 * pour toute la vie de la rangée — vidée au lâcher.
 */
export function useLastSeen<T>(items: readonly T[], held: boolean, keyOf: (item: T) => string): Map<string, T> {
  const lastSeen = useRef(new Map<string, T>());
  useLayoutEffect(() => {
    if (!held) {
      lastSeen.current.clear();
      return;
    }
    for (const item of items) lastSeen.current.set(keyOf(item), item);
  }, [items, held, keyOf]);
  return lastSeen.current;
}

/**
 * Les cartes à rendre d'une rangée, tenue (`held`) ou non. `keyOf` : stable (hors du rendu).
 * Des titres Jellyfin : `useHeldMediaRowItems`, qui lit aussi le cache.
 */
export function useHeldRowItems<T>(items: readonly T[], held: boolean, keyOf: (item: T) => string): readonly T[] {
  const frozen = useRowSnapshot(items, held);
  const seen = useLastSeen(items, held, keyOf);
  return useMemo(() => heldRowView(items, frozen, held, keyOf, undefined, seen), [items, frozen, held, keyOf, seen]);
}
