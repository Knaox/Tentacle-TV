/**
 * Octave — les titres EN ATTENTE (point d'extension 4) mêlés aux listes de la
 * bibliothèque : « Titres likés » et les playlists montrent tout de suite ce
 * qu'on vient d'aimer ou d'ajouter, lisible par le cache de l'extension, à sa
 * place, jusqu'à ce que l'élément Jellyfin le remplace (`music:resolved`).
 *
 * Règle pure. Un titre en attente dont l'enregistrement (MBID) est déjà là,
 * ou dont l'élément Jellyfin est connu, cède sa place : jamais de doublon.
 */

import { pendingAsPlaylistEntry, type MusicPlaylistEntry, type MusicTrack, type PendingMusicItem } from "../music";

export interface ListRow {
  /** Clé de rangée stable : la clé du titre, ou `pending:<operationId>`. */
  rowKey: string;
  track: MusicTrack;
  /** `null` pour une ligne réelle ; sinon l'état de l'attente. */
  pending: null | { operationId: string; failed: boolean };
  /** L'entrée de playlist Jellyfin (retrait, déplacement), `null` pour une attente. */
  entryId: string | null;
}

function asPendingTrack(item: PendingMusicItem): MusicTrack {
  return { ...item.track, availability: "pending", favorite: item.kind === "like" ? true : item.track.favorite };
}

function knownRecordings(tracks: readonly MusicTrack[]): Set<string> {
  const out = new Set<string>();
  for (const t of tracks) if (t.mbids.recording) out.add(t.mbids.recording);
  return out;
}

function alreadyThere(item: PendingMusicItem, recordings: Set<string>, keys: Set<string>): boolean {
  const recording = item.track.mbids.recording;
  return (recording !== null && recordings.has(recording)) || keys.has(item.track.key);
}

function pendingRow(item: PendingMusicItem): ListRow {
  return { rowKey: `pending:${item.operationId}`, track: asPendingTrack(item), pending: { operationId: item.operationId, failed: item.state === "failed" }, entryId: null };
}

/** « Titres likés » : les attentes d'abord (les plus récentes en tête), puis les favoris Jellyfin. */
export function mergeLiked(liked: readonly MusicTrack[], pending: readonly PendingMusicItem[]): ListRow[] {
  const recordings = knownRecordings(liked);
  const keys = new Set(liked.map((t) => t.key));
  const waiting = pending
    .filter((item) => item.kind === "like" && !alreadyThere(item, recordings, keys))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(pendingRow);
  return [...waiting, ...liked.map((track) => ({ rowKey: track.key, track, pending: null, entryId: null }))];
}

/** Une playlist : chaque attente à la position voulue (fin si absente). */
export function mergePlaylist(entries: readonly MusicPlaylistEntry[], pending: readonly PendingMusicItem[], playlistId: string): ListRow[] {
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  const tracks = ordered.map((e) => e.track);
  const recordings = knownRecordings(tracks);
  const keys = new Set(tracks.map((t) => t.key));
  const waiting = pending
    .filter((item) => item.kind === "playlistAdd" && item.playlistId === playlistId && !alreadyThere(item, recordings, keys))
    .map((item) => ({ item, entry: pendingAsPlaylistEntry(item) }))
    .sort((a, b) => a.entry.position - b.entry.position || a.item.createdAt - b.item.createdAt);

  const rows: ListRow[] = [];
  let w = 0;
  ordered.forEach((entry, index) => {
    while (w < waiting.length && (waiting[w]?.entry.position ?? Infinity) <= index) {
      rows.push(pendingRow((waiting[w] as { item: PendingMusicItem }).item));
      w += 1;
    }
    rows.push({ rowKey: `${entry.entryId}`, track: entry.track, pending: null, entryId: entry.entryId });
  });
  for (; w < waiting.length; w += 1) rows.push(pendingRow((waiting[w] as { item: PendingMusicItem }).item));
  return rows;
}
