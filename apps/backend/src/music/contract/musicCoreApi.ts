/**
 * Octave — les routes MUSIQUE du cœur (`/api/music/*`), servies par le backend
 * Tentacle sous la capacité `music.library` (contrat, docs/octave/CONTRATS.md).
 *
 * Le cœur ne sert QUE la bibliothèque Jellyfin : aucune source extérieure,
 * aucun nom d'extension. Toutes les routes exigent la session (requireAuth) et
 * respectent les droits Jellyfin du compte (bibliothèques visibles, contrôle
 * parental) ; un compte qui ne voit pas la bibliothèque musique reçoit des
 * listes vides — jamais une erreur qui trahit son existence.
 */

import type { Mbid, MusicAlbum, MusicArtist, MusicPage, MusicPlaylist, MusicPlaylistEntry, MusicTrack } from "./musicTypes";
import type { PlaybackSource } from "./musicPlayback";
import type { MusicListStats } from "./musicListOrder";
import type { MusicPlaylistCover } from "./musicMosaic";

export const MUSIC_ROUTES = {
  /** GET — l'état : y a-t-il une bibliothèque musique visible pour ce compte ? */
  status: "/api/music/status",
  /** GET ?q=&limit= — index local (SQLite FTS5) : première réponse < 100 ms. */
  search: "/api/music/search",
  /** GET ?cursor=&limit=&sort= — albums de la bibliothèque. */
  albums: "/api/music/albums",
  /** GET /:id — un album et ses titres. */
  album: "/api/music/albums/:id",
  /** GET ?cursor=&limit= */
  artists: "/api/music/artists",
  /** GET /:id — un artiste, ses titres phares, ses albums. */
  artist: "/api/music/artists/:id",
  /** GET — l'accueil (récents, ajouts, souvent écoutés). */
  home: "/api/music/home",
  /** GET ?cursor= — « Titres likés » = les titres audio favoris Jellyfin du compte. */
  liked: "/api/music/liked",
  /** PUT /:id { favorite } — pose ou retire le favori Jellyfin (= le cœur). */
  favorite: "/api/music/favorite/:id",
  /** GET — les playlists Jellyfin du compte ; POST { name, itemIds? } — en crée une. */
  playlists: "/api/music/playlists",
  /** GET /:id ; PATCH /:id { name?, description? } (la description : `music.playlistManage`) ; DELETE /:id */
  playlist: "/api/music/playlists/:id",
  /** POST /:id/entries { itemIds, position? } — insère à une position (fin si absente). */
  playlistEntries: "/api/music/playlists/:id/entries",
  /** PATCH /:id/entries/:entryId { position } — déplace ; DELETE — retire. */
  playlistEntry: "/api/music/playlists/:id/entries/:entryId",
  /** POST { recordings: Mbid[] } — retrouve des éléments audio par MBID d'enregistrement. */
  byMbid: "/api/music/by-mbid",
  /** POST `MusicMatchRequest` — ce que la bibliothèque a parmi des titres et albums d'ailleurs (capacité `music.libraryMatch`). */
  match: "/api/music/match",
  /** GET /:id — la source de lecture d'un titre de la bibliothèque. */
  source: "/api/music/source/:id",
  /** GET /:id — le flux DIRECT du fichier (Range), jamais transcodé. */
  stream: "/api/music/stream/:id",
  /** GET /:id?size= — pochette (relayée, mise en cache). */
  artwork: "/api/music/artwork/:id",
  /** POST { itemId, positionMs, event } — rapport d'écoute à Jellyfin (start, progress, stop). */
  playback: "/api/music/playback",
  /** POST `MusicOfflinePlanRequest` — d'où et sous quelle forme garder hors ligne des titres (capacité `offline.music`, bureau). */
  offlinePlan: "/api/music/offline/plan",
} as const;

/** `POST /api/music/offline/plan` — des titres de la bibliothèque à garder sur CET appareil (200 au plus). */
export interface MusicOfflinePlanRequest {
  ids: string[];
}

/**
 * Un titre planifié : le chemin du serveur Tentacle d'où le tirer (l'original, ou l'Allégé audio `a256` si
 * l'administration le permet et que la source y gagne), son conteneur, sa taille exacte (original) ou estimée.
 */
export interface MusicOfflineTrackPlan {
  id: string;
  variant: "original" | "light";
  preset: string | null;
  path: string;
  container: string;
  expectedSize: number | null;
  estimatedSize: number | null;
}

/** La réponse : les titres planifiés, et ceux que ce compte ne peut pas garder (`refused`). 404 : aucun hors ligne. */
export interface MusicOfflinePlanResponse {
  tracks: MusicOfflineTrackPlan[];
  refused: string[];
}

export interface MusicStatus {
  /** Faux : aucune bibliothèque musique visible — le mode Octave ne s'offre pas. */
  available: boolean;
  /** La bibliothèque musique dédiée (Jellyfin `CollectionType = music`), si le compte la voit. */
  libraryId: string | null;
  /** L'index local est-il prêt (premier passage fini) ? */
  indexReady: boolean;
  trackCount: number;
  /** `octave.rights` (1.40.0) : faux = le compte n'a pas « Accès à Octave » (`available` est alors faux).
   *  Absent : serveur d'avant, ou accès permis. */
  octaveAccess?: boolean;
}

export interface MusicSearchResponse {
  query: string;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  playlists: MusicPlaylist[];
  /** Durée côté serveur, pour les bancs (ms). */
  tookMs: number;
}

export interface MusicHomeResponse {
  recentlyPlayed: MusicTrack[];
  recentlyAdded: MusicAlbum[];
  mostPlayed: MusicTrack[];
  playlists: MusicPlaylist[];
  /** Les suggestions tirées de l'écoute du compte (ajout du 26/10, lot « ambiances »). Absent : serveur
   *  d'avant — l'accueil n'en montre rien, sans erreur. */
  forYou?: MusicHomeForYou;
}

/**
 * Un MIX de l'accueil, composé par le serveur d'après l'écoute du compte, renouvelé chaque jour :
 * un artiste qu'on écoute beaucoup mêlé aux titres aimés ou écoutés d'artistes voisins dans ses
 * habitudes (`artist`), ou ses coups de cœur mélangés (`favorites`). Les titres sont DANS la réponse :
 * le lancer n'attend aucune requête.
 */
export interface MusicHomeMix {
  /** Stable pour la journée : `artist:<id>` ou `favorites`. */
  id: string;
  kind: "artist" | "favorites";
  /** L'artiste qui donne son nom au mix (`artist`), sinon `null`. */
  artist: MusicArtist | null;
  /** Les artistes du mix, les plus présents d'abord (trois au plus) : le sous-titre. */
  artistNames: string[];
  tracks: MusicTrack[];
}

/** « Parce que vous avez écouté X » : d'autres albums de X dans la bibliothèque, pas écoutés récemment. */
export interface MusicHomeBecause {
  artist: MusicArtist;
  albums: MusicAlbum[];
}

export interface MusicHomeForYou {
  /** Les albums des écoutes récentes, le plus récent d'abord (une fois chacun). */
  recentAlbums: MusicAlbum[];
  /** Les artistes des écoutes récentes, le plus récent d'abord. */
  recentArtists: MusicArtist[];
  mixes: MusicHomeMix[];
  because: MusicHomeBecause[];
}

export interface MusicArtistResponse extends MusicArtist {
  topTracks: MusicTrack[];
  albums: MusicAlbum[];
}

/** Les likés, dans l'ordre de la préférence du compte ; `stats` par identifiant Jellyfin (capacité `music.listOrder`). */
export interface MusicLikedPage extends MusicPage<MusicTrack> {
  stats?: Record<string, MusicListStats>;
}
export type MusicAlbumPage = MusicPage<MusicAlbum>;
export type MusicArtistPage = MusicPage<MusicArtist>;

export interface MusicPlaylistDetail extends MusicPlaylist {
  entries: MusicPlaylistEntry[];
  /**
   * De quoi refaire la jaquette SANS RÉSEAU (serveur 1.40.0) : l'appareil qui garde la playlist le garde, et
   * « Sur cet appareil » montre exactement la jaquette en ligne, chaque jour (`coverUrlsOf`). Absent : un serveur
   * d'avant.
   */
  cover?: MusicPlaylistCover;
}

export interface MusicByMbidResponse {
  matches: { recording: Mbid; jellyfinId: string; track: MusicTrack }[];
}

/**
 * Des titres et des albums montrés hors bibliothèque, à confronter à l'index local (aucune requête à
 * Jellyfin ni à l'extension). `ref` est la clé du client (`ext:…`), rendue telle quelle. Règle :
 * `musicLibraryMatch.ts`. Bornes : 200 titres, 50 albums, 300 titres d'albums en tout.
 */
export interface MusicMatchTrackQuery {
  ref: string;
  title: string;
  artists: { name: string; mbid: Mbid | null }[];
  albumTitle: string | null;
  durationMs: number | null;
  recording: Mbid | null;
  discNumber?: number | null;
  trackNumber?: number | null;
}

export interface MusicMatchAlbumQuery {
  ref: string;
  title: string;
  artists: { name: string; mbid: Mbid | null }[];
  release: Mbid | null;
  releaseGroup: Mbid | null;
  compilation: boolean;
  trackCount: number | null;
  /** Les titres de l'album, quand le client les a (vue album) : la couverture se dit alors piste par piste. */
  tracks?: MusicMatchTrackQuery[];
}

export interface MusicMatchRequest {
  tracks?: MusicMatchTrackQuery[];
  albums?: MusicMatchAlbumQuery[];
}

export interface MusicMatchResponse {
  /** Les titres que la bibliothèque a (visibles par ce compte), par `ref`. */
  tracks: { ref: string; track: MusicTrack }[];
  /**
   * Les albums reconnus : `full` = tous ses titres y sont (sans liste : au moins autant de titres que
   * l'album en compte), sinon `partial` ; `tracks` = ceux de ses titres que la bibliothèque a, par `ref`.
   */
  albums: { ref: string; album: MusicAlbum; coverage: "full" | "partial"; tracks: { ref: string; track: MusicTrack }[] }[];
}

export type MusicSourceResponse = PlaybackSource;

export type MusicPlaybackEvent = "start" | "progress" | "pause" | "stop";

export interface MusicPlaybackReport {
  itemId: string;
  positionMs: number;
  event: MusicPlaybackEvent;
  /** Écoute menée au bout (stop à plus de 90 % de la durée). */
  completed?: boolean;
}
