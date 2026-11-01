/**
 * Octave — l'ORDRE des collections de « Sur cet appareil » (lot « ol », 01/11), règle pure
 * (`deviceCollectionOrder.test.ts`) : hors ligne, les playlists gardées se rangent comme la bibliothèque les
 * montrait en ligne — « Titres likés » en tête, puis les playlists dans l'ordre de la rubrique (favorites,
 * puis le reste, ordre personnel du compte : `usePlaylistShelf`), puis le reste (albums, playlists que la
 * bibliothèque ne connaît pas) dans l'ordre d'avant.
 */

/** `libraryOrder` : les clés de rubrique (`jf:<id>`, `ext:<extension>:<id>`) dans l'ordre affiché en ligne. */
export function orderDeviceCollections<T extends { key: string }>(collections: readonly T[], libraryOrder: readonly string[]): T[] {
  const rank = new Map<string, number>();
  rank.set("playlist:liked", -1);
  libraryOrder.forEach((key, index) => {
    if (!rank.has(`playlist:${key}`)) rank.set(`playlist:${key}`, index);
  });
  const decorated = collections.map((item, index) => ({ item, index, rank: rank.get(item.key) }));
  decorated.sort((a, b) => {
    if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
    if (a.rank !== undefined) return -1;
    if (b.rank !== undefined) return 1;
    return a.index - b.index;
  });
  return decorated.map((d) => d.item);
}
