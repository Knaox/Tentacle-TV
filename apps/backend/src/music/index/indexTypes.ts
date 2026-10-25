/**
 * Octave — une ligne de l'index local (`music_items`), telle que le code la
 * manipule. Copie de ce que JELLYFIN dit d'un élément : rien d'un compte
 * (ni favori, ni lecture, ni playlist) n'y entre.
 */

import type { MusicAudioFormat } from "../contract/musicTypes";

export type IndexKind = "track" | "album" | "artist";

export interface IndexArtist {
  /** L'élément MusicArtist de Jellyfin, normalisé. */
  id: string | null;
  name: string;
  mbid: string | null;
}

export interface IndexRow {
  id: string;
  kind: IndexKind;
  name: string;
  sortName: string;
  albumId: string | null;
  albumName: string | null;
  albumArtist: string | null;
  /** Les artistes, dans l'ordre du crédit (titre, album), l'artiste lui-même pour un artiste. */
  artists: IndexArtist[];
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  durationMs: number | null;
  recordingMbid: string | null;
  releaseMbid: string | null;
  releaseGroupMbid: string | null;
  artistMbid: string | null;
  format: MusicAudioFormat | null;
  sizeBytes: number | null;
  normalizationGain: number | null;
  /** `<id de l'élément qui porte l'image>/<étiquette>` : un titre sans pochette prend celle de son album. */
  imageTag: string | null;
  /** Album : ses titres ; artiste : rien. */
  childCount: number | null;
  /** Ms epoch (UTC) — l'ajout à Jellyfin. */
  dateCreated: number | null;
}
