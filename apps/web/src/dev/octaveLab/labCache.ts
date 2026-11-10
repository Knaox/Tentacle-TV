/**
 * Labo d'Octave — le cache de requêtes PRÉ-REMPLI : chaque page a ses données dès le premier
 * rendu (aucune attente, aucun squelette entre deux captures). Les clés sont celles des crochets
 * d'api-client (`musicKeys`, `appConfigQuery`) ; ce qui n'est pas ici est servi par le faux serveur.
 *
 * Une route RETENUE ou en ÉCHEC par la scène n'est pas pré-remplie : la vue montre son attente ou
 * son erreur.
 */

import { QueryClient } from "@tanstack/react-query";
import { appConfigQuery, musicKeys, type MusicAlbumSort } from "@tentacle-tv/api-client";
import { LAB_ALBUMS, LAB_ARTISTS } from "./data/labCatalog";
import { artistDetail, LAB_HOME, LAB_LIKED, LAB_LIKED_EMPTY, LAB_SHELVES, LAB_STATUS } from "./data/labHome";
import { LAB_PLAYLISTS, playlistDetail } from "./data/labPlaylists";
import { albumDetail, LAB_TRACKS, sourceOf } from "./data/labTracks";
import { LAB_CONFIG, type LabServerRules } from "./labServer";

/** La taille de page des listes de la bibliothèque (`useMusicAlbums`, `useMusicArtists`). */
const PAGE_LIMIT = 60;
/** « Titres likés » : par 500 avec `music.listOrder` (`useWholeLiked`), par 100 sinon. */
const LIKED_LIMITS: readonly number[] = [500, 100];
const ALBUM_SORTS: readonly MusicAlbumSort[] = ["recent", "name", "year"];

interface Seed {
  /** La route du serveur qui sert cette donnée (les règles de la scène s'y lisent). */
  path: string;
  key: readonly unknown[];
  data: unknown;
}

/** Une liste paginée telle que `useInfiniteQuery` la garde : une seule page, sans suite. */
const onePage = <T,>(items: readonly T[]) => ({ pages: [{ items: [...items], total: items.length, cursor: null }], pageParams: [""] });

function seeds(rules: LabServerRules): Seed[] {
  const liked = rules.emptyLiked ? LAB_LIKED_EMPTY : LAB_LIKED;
  return [
    { path: "/api/config", key: appConfigQuery().queryKey, data: LAB_CONFIG },
    { path: "/api/music/status", key: musicKeys.status(), data: LAB_STATUS },
    { path: "/api/music/home", key: musicKeys.home(), data: LAB_HOME },
    { path: "/api/music/playlists", key: musicKeys.playlists(), data: [...LAB_PLAYLISTS] },
    { path: "/api/music/library/shelves", key: musicKeys.shelves(), data: LAB_SHELVES },
    ...LIKED_LIMITS.map((limit) => ({ path: "/api/music/liked", key: musicKeys.liked(limit), data: { pages: [liked], pageParams: [""] } })),
    { path: "/api/music/artists", key: musicKeys.artists(PAGE_LIMIT), data: onePage(LAB_ARTISTS) },
    ...ALBUM_SORTS.map((sort) => ({ path: "/api/music/albums", key: musicKeys.albums(sort, PAGE_LIMIT), data: onePage(LAB_ALBUMS) })),
    ...LAB_ALBUMS.map((album) => ({ path: `/api/music/albums/${album.jellyfinId ?? ""}`, key: musicKeys.album(album.jellyfinId ?? ""), data: albumDetail(album.jellyfinId ?? "") })),
    ...LAB_ARTISTS.map((artist) => ({ path: `/api/music/artists/${artist.jellyfinId ?? ""}`, key: musicKeys.artist(artist.jellyfinId ?? ""), data: artistDetail(artist.jellyfinId ?? "") })),
    ...LAB_PLAYLISTS.map((playlist) => ({ path: `/api/music/playlists/${playlist.jellyfinId}`, key: musicKeys.playlist(playlist.jellyfinId), data: playlistDetail(playlist.jellyfinId) })),
    // Les sources : le lecteur les demande au clic, elles sont là dans le tour même.
    ...LAB_TRACKS.map((track) => ({ path: `/api/music/source/${track.jellyfinId ?? ""}`, key: musicKeys.source(track.jellyfinId ?? ""), data: sourceOf(track) })),
  ];
}

export function createLabQueryClient(rules: LabServerRules): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: false },
    },
  });
  const skipped = [...rules.hold, ...rules.fail];
  for (const seed of seeds(rules)) {
    if (skipped.some((rule) => rule.test(seed.path))) continue;
    client.setQueryData(seed.key, seed.data);
  }
  return client;
}
