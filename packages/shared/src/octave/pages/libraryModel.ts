/**
 * Octave — les règles PURES de la bibliothèque : ses onglets (dans l'adresse,
 * `?tab=`), les tris d'albums demandés au serveur et le tri retenu sur
 * l'appareil (même clé sur le web et le mobile).
 */

export const LIBRARY_TABS = ["albums", "artists", "playlists"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

/** L'onglet d'une adresse ; « albums » pour une valeur absente ou inconnue. */
export function parseLibraryTab(value: unknown): LibraryTab {
  return LIBRARY_TABS.find((tab) => tab === value) ?? "albums";
}

export type LibraryAlbumSort = "recent" | "name" | "year";

/** Les tris demandés au serveur (`/api/music/albums?sort=`), et leur libellé (espace `music`). */
export const LIBRARY_ALBUM_SORTS: readonly { value: LibraryAlbumSort; key: string }[] = [
  { value: "recent", key: "library.sortAdded" },
  { value: "name", key: "library.sortName" },
  { value: "year", key: "library.sortYear" },
];

/** Clé de stockage du tri des albums : ne jamais la renommer. */
export const LIBRARY_ALBUM_SORT_KEY = "tentacle_octave_album_sort";

export function parseAlbumSort(value: unknown): LibraryAlbumSort {
  return LIBRARY_ALBUM_SORTS.find((s) => s.value === value)?.value ?? "recent";
}
