/**
 * Octave — les règles PURES de la bibliothèque : ses onglets (dans l'adresse,
 * `?tab=`), les tris d'albums demandés au serveur et le tri retenu sur
 * l'appareil (même clé sur le web et le mobile).
 */

export const LIBRARY_TABS = ["albums", "artists", "playlists"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

/** L'onglet d'une adresse ; `fallback` (« albums » par défaut) pour une valeur absente ou inconnue. */
export function parseLibraryTab(value: unknown, fallback: LibraryTab = "albums"): LibraryTab {
  return LIBRARY_TABS.find((tab) => tab === value) ?? fallback;
}

/**
 * Le MOBILE ouvre sa bibliothèque sur les Playlists (retour de Damien, 28/10) : elles viennent en tête des
 * puces et valent l'onglet d'une adresse sans `?tab=`. Le web et le bureau gardent les Albums d'abord.
 */
export const MOBILE_LIBRARY_TABS: readonly LibraryTab[] = ["playlists", "albums", "artists"];
export const MOBILE_LIBRARY_DEFAULT_TAB: LibraryTab = MOBILE_LIBRARY_TABS[0]!;

/** Le `?tab=` à écrire pour un onglet du mobile : rien pour l'onglet par défaut (l'adresse reste nue). */
export function mobileLibraryTabParam(tab: LibraryTab): LibraryTab | undefined {
  return tab === MOBILE_LIBRARY_DEFAULT_TAB ? undefined : tab;
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
