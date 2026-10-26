/**
 * Octave — le modèle d'un titre, d'un album, d'un artiste et d'une playlist,
 * le MÊME qu'il vienne de la bibliothèque Jellyfin ou d'une extension.
 *
 * Contrat du lot Octave (docs/octave/CONTRATS.md) : les agents codent contre
 * ces types, jamais les uns contre les autres. Une évolution passe par le
 * coordinateur. Les noms de champs traversent le réseau (JSON du cœur ET des
 * extensions) : ils ne se renomment jamais, ils s'ajoutent.
 *
 * Source de vérité = JELLYFIN : le cœur (« j'aime ») EST le favori Jellyfin du
 * compte, une playlist EST une playlist Jellyfin. Aucun stockage propre au cœur.
 */

import type { MusicListStats } from "./musicListOrder";

/** Un identifiant MusicBrainz (UUID en minuscules). */
export type Mbid = string;

/**
 * Où en est un titre pour CE compte :
 * - `library` : un élément audio de la bibliothèque Jellyfin ;
 * - `cache` : hors bibliothèque, déjà gardé par l'extension (lecture immédiate) ;
 * - `pending` : aimé ou ajouté à une playlist, son élément Jellyfin arrive (secondes) ;
 * - `remote` : hors bibliothèque, rien de gardé (lecture à résoudre).
 */
export type TrackAvailability = "library" | "cache" | "pending" | "remote";

export interface MusicMbids {
  recording: Mbid | null;
  release: Mbid | null;
  releaseGroup: Mbid | null;
  /** Les artistes du titre, dans l'ordre du crédit. */
  artists: Mbid[];
}

export interface MusicArtistRef {
  name: string;
  mbid: Mbid | null;
  /** L'élément MusicArtist de Jellyfin, s'il existe. */
  jellyfinId: string | null;
  /**
   * La vue de l'artiste chez l'extension qui a donné le titre (hors bibliothèque), si elle en sert une —
   * « Voir l'artiste » d'un titre d'ailleurs. Optionnel, ajouté le 25/10 : une extension d'avant ne
   * l'envoie pas (pas de lien, sans erreur). `jellyfinId` passe avant.
   */
  external?: ExternalRef | null;
}

export interface MusicAlbumRef {
  title: string;
  mbid: Mbid | null;
  jellyfinId: string | null;
  /** La vue de l'album chez l'extension (hors bibliothèque) ; mêmes règles que `MusicArtistRef.external`. */
  external?: ExternalRef | null;
}

/** Ce que le fichier est vraiment — affiché dans la barre de lecture (format/qualité). */
export interface MusicAudioFormat {
  /** « flac », « alac », « opus », « aac », « mp3 », « wav », « dsd »… en minuscules. */
  codec: string;
  container: string | null;
  sampleRate: number | null;
  bitDepth: number | null;
  /** Bits par seconde. */
  bitrate: number | null;
  channels: number | null;
  lossless: boolean;
}

/** Une extension, et SON identifiant opaque du titre (le cœur ne l'analyse jamais). */
export interface ExternalRef {
  pluginId: string;
  id: string;
}

export interface MusicTrack {
  /**
   * La clé STABLE d'un titre dans les listes et la file : `jf:<itemId>` pour la
   * bibliothèque, `ext:<pluginId>:<externalId>` hors bibliothèque
   * (`trackKeyOf`, musicKeys.ts). Jamais une position.
   */
  key: string;
  jellyfinId: string | null;
  external: ExternalRef | null;
  title: string;
  artists: MusicArtistRef[];
  album: MusicAlbumRef | null;
  durationMs: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  /**
   * L'image (pochette) : une URL du cœur (`/api/music/...`), une route de l'extension relayée par
   * le cœur (`/api/plugins/<id>/…`, servie de son cache), ou une URL https publique — jamais
   * Jellyfin en direct. Le jeton n'accompagne jamais une URL d'un autre hôte.
   */
  artworkUrl: string | null;
  mbids: MusicMbids;
  availability: TrackAvailability;
  /** Connu pour la bibliothèque ; pour une extension, dès que son cache le sait. */
  format: MusicAudioFormat | null;
  /** Favori Jellyfin du compte (ou cœur déjà posé sur un titre `pending`). */
  favorite: boolean;
  /** Contenu explicite, si la source le dit. */
  explicit?: boolean;
}

export type AlbumKind = "album" | "single" | "ep" | "compilation" | "live" | "soundtrack" | "other";

export interface MusicAlbum {
  key: string;
  jellyfinId: string | null;
  external: ExternalRef | null;
  title: string;
  artists: MusicArtistRef[];
  year: number | null;
  /** Date complète de sortie (AAAA-MM-JJ), si connue. */
  releaseDate: string | null;
  kind: AlbumKind;
  artworkUrl: string | null;
  trackCount: number | null;
  durationMs: number | null;
  mbids: { release: Mbid | null; releaseGroup: Mbid | null };
  /** Label, si connu (« Columbia »…). */
  label?: string | null;
  /** Rendu par la vue album seulement (pas par la recherche). */
  tracks?: MusicTrack[];
}

export interface MusicArtist {
  key: string;
  jellyfinId: string | null;
  external: ExternalRef | null;
  name: string;
  mbid: Mbid | null;
  imageUrl: string | null;
  /** Rendus par la vue artiste seulement. */
  topTracks?: MusicTrack[];
  albums?: MusicAlbum[];
}

/** Une entrée de playlist : réelle (Jellyfin) ou en attente de son élément. */
export interface MusicPlaylistEntry {
  /** `PlaylistItemId` de Jellyfin, ou `pending:<operationId>` tant que l'élément n'existe pas. */
  entryId: string;
  position: number;
  track: MusicTrack;
  /** Pour trier (capacité `music.listOrder`) : l'ajout à la playlist, les écoutes du compte. */
  stats?: MusicListStats;
}

export interface MusicPlaylist {
  /** L'élément Playlist de Jellyfin — toujours réel, jamais créé ailleurs. */
  jellyfinId: string;
  name: string;
  trackCount: number;
  durationMs: number | null;
  artworkUrl: string | null;
  /** Le compte peut-il la modifier (propriétaire ou partage en écriture) ? */
  editable: boolean;
  entries?: MusicPlaylistEntry[];
}

/** Une page d'une liste : curseur opaque, `null` à la fin. */
export interface MusicPage<T> {
  items: T[];
  total: number | null;
  cursor: string | null;
}
