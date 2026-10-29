/**
 * Octave — les FAVORIS de la bibliothèque d'un compte, par rubrique, et l'ordre personnel de chacune
 * (`GET /api/music/library/shelves`, contrat `musicLibraryShelves.ts`). Les favoris de la bibliothèque sont ceux de
 * Jellyfin (déjà relevés pour le cœur : `userFavorites.ts`, aucune requête de plus) ; ceux qu'il ne peut pas tenir
 * viennent de Tentacle. L'ordre n'est PAS appliqué ici : les clients le font (règle pure partagée `libraryShelves`).
 */

import { MUSIC_SHELF_SECTIONS, type MusicLibraryShelves, type MusicShelfExternalPlaylist, type MusicShelfPlaylist } from "../contract/musicLibraryShelves";
import type { MusicAlbum, MusicArtist } from "../contract/musicTypes";
import { readShelfOrder } from "../listOrder/shelfOrderStore";
import { playlistsView } from "../view/playlistViews";
import { albumsOf, artistsOf, visibleInOrder, type UserView } from "../view/viewContext";
import { readSnapshot } from "./shelfSnapshot";
import { listShelfFavorites } from "./shelfFavoriteStore";

const EMPTY: MusicLibraryShelves = { albums: [], artists: [], playlists: [], order: { albums: [], artists: [], playlists: [] } };

export async function shelvesView(view: UserView): Promise<MusicLibraryShelves> {
  if (view.access.mode === "none") return EMPTY;
  const [rows, stored, playlists, orders] = await Promise.all([
    // L'ensemble des favoris porte aussi les titres : seuls les albums et les artistes sont gardés.
    visibleInOrder(view, [...view.favorites]),
    listShelfFavorites(view.userId).catch(() => []),
    playlistsView(view),
    Promise.all(MUSIC_SHELF_SECTIONS.map((s) => readShelfOrder(view.userId, s).catch(() => []))),
  ]);
  const albums: MusicAlbum[] = await albumsOf(view, rows.filter((r) => r.kind === "album"));
  const artists: MusicArtist[] = artistsOf(rows.filter((r) => r.kind === "artist"), view);
  const shelfPlaylists: MusicShelfPlaylist[] = playlists.filter((p) => p.favorite === true).map((playlist) => ({ kind: "library", playlist }));
  for (const row of stored) {
    if (!row.itemKey.startsWith("ext:")) continue;
    const snapshot = readSnapshot(row.section, row.snapshotJson);
    if (!snapshot) continue;
    if (row.section === "albums") albums.push(snapshot as MusicAlbum);
    else if (row.section === "artists") artists.push(snapshot as MusicArtist);
    else shelfPlaylists.push({ kind: "external", playlist: snapshot as MusicShelfExternalPlaylist });
  }
  return { albums, artists, playlists: shelfPlaylists, order: { albums: orders[0]!, artists: orders[1]!, playlists: orders[2]! } };
}
