/**
 * Octave mobile — la grille de la bibliothèque en RANGÉES : « Vos favoris » (titre, puis ses cartes), puis le
 * reste sous son propre titre (« Tous les albums »…). Une liste virtualisée à colonnes ne sait pas faire
 * tenir un titre sur toute sa largeur : on lui donne des rangées toutes faites. Sans favori, pas de titre —
 * la grille d'avant, à l'identique. Pur : l'ordre vient de `arrangeShelf` (partagé), ceci ne fait que poser.
 */

export type LibrarySectionId = "favorites" | "rest";

export type LibraryRow<T> =
  | { type: "title"; key: string; section: LibrarySectionId; count: number }
  | { type: "cards"; key: string; section: LibrarySectionId; items: T[] };

export function buildLibraryRows<T>(input: { favorites: readonly T[]; rest: readonly T[]; columns: number; keyOf: (item: T) => string }): LibraryRow<T>[] {
  const { favorites, rest, keyOf } = input;
  const columns = Math.max(1, input.columns);
  const rows: LibraryRow<T>[] = [];
  const pack = (section: LibrarySectionId, items: readonly T[]) => {
    for (let i = 0; i < items.length; i += columns) {
      const chunk = items.slice(i, i + columns);
      rows.push({ type: "cards", key: `${section}:${keyOf(chunk[0]!)}`, section, items: chunk });
    }
  };
  if (favorites.length > 0) {
    rows.push({ type: "title", key: "title:favorites", section: "favorites", count: favorites.length });
    pack("favorites", favorites);
    if (rest.length > 0) rows.push({ type: "title", key: "title:rest", section: "rest", count: rest.length });
  }
  pack("rest", rest);
  return rows;
}
