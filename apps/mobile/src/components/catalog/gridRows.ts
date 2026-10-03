/**
 * Les rangées d'une grille de cartes, découpées par l'app et STABLES d'un
 * rendu à l'autre.
 *
 * Une `FlatList` à `numColumns` fabrique un tableau neuf pour chaque rangée à
 * chaque rendu : toutes ses cellules montées se re-rendent alors à chaque mise
 * à jour de sa fenêtre — c'est-à-dire à chaque pas d'un défilement. Ici, une
 * rangée dont les titres n'ont pas changé est RENDUE telle quelle (même
 * tableau) : la liste ne retravaille que les rangées qui entrent ou sortent.
 * Une page de plus ne touche que la dernière rangée, si elle était incomplète.
 */
export type GridRow<T> = readonly T[];

/** La clé d'une rangée : son premier titre, à ce nombre de colonnes. */
export function gridRowKey<T extends { Id: string }>(row: GridRow<T>): string {
  return row[0]?.Id ?? "";
}

function sameItems<T>(a: GridRow<T>, b: readonly T[], start: number, length: number): boolean {
  if (a.length !== length) return false;
  for (let i = 0; i < length; i++) if (a[i] !== b[start + i]) return false;
  return true;
}

/**
 * Découpe `items` en rangées de `columns`, en reprenant de `previous` toute
 * rangée identique (mêmes objets, même ordre). Rend aussi le cache du rendu
 * suivant.
 */
export function chunkGridRows<T extends { Id: string }>(
  items: readonly T[],
  columns: number,
  previous: ReadonlyMap<string, GridRow<T>>,
): { rows: GridRow<T>[]; cache: Map<string, GridRow<T>> } {
  const size = Math.max(1, Math.floor(columns));
  const rows: GridRow<T>[] = [];
  const cache = new Map<string, GridRow<T>>();
  for (let start = 0; start < items.length; start += size) {
    const length = Math.min(size, items.length - start);
    const key = `${size}:${items[start].Id}`;
    const before = previous.get(key);
    const row = before && sameItems(before, items, start, length) ? before : items.slice(start, start + length);
    rows.push(row);
    cache.set(key, row);
  }
  return { rows, cache };
}
