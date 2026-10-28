/**
 * Octave — les titres EN ATTENTE (point d'extension 4) mêlés aux listes de la
 * bibliothèque : « Titres likés » et les playlists montrent tout de suite ce
 * qu'on vient d'aimer ou d'ajouter, lisible par le cache de l'extension, à sa
 * place, jusqu'à ce que l'élément Jellyfin le remplace (`music:resolved`).
 *
 * Règle pure. Un titre en attente dont l'enregistrement (MBID) est déjà là,
 * ou dont l'élément Jellyfin est connu, cède sa place : jamais de doublon.
 */

import { pendingAsPlaylistEntry, sourcePlace, type MusicPlaylistEntry, type MusicTrack, type PendingMusicItem } from "../music";
import { sameRecording } from "./trackTwins";

export interface ListRow {
  /** Clé de rangée stable : la clé du titre, ou `pending:<operationId>`. */
  rowKey: string;
  track: MusicTrack;
  /** `null` pour une ligne réelle ; sinon l'état de l'attente, et ce que l'extension en dit (`note`). */
  pending: null | { operationId: string; failed: boolean; note: string | null };
  /** L'entrée de playlist Jellyfin (retrait, déplacement), `null` pour une attente. */
  entryId: string | null;
}

function asPendingTrack(item: PendingMusicItem): MusicTrack {
  // Une entrée IMPORTÉE n'attend rien (musicImport.ts) : elle garde la disponibilité que l'extension lui donne.
  return { ...item.track, availability: item.imported === true ? item.track.availability : "pending", favorite: item.kind === "like" ? true : item.track.favorite };
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
  const pending = { operationId: item.operationId, failed: item.state === "failed", note: typeof item.note === "string" && item.note ? item.note : null };
  return { rowKey: `pending:${item.operationId}`, track: asPendingTrack(item), pending, entryId: null };
}

/**
 * « Titres likés » : les attentes d'abord (les plus récentes en tête), puis les favoris Jellyfin. Un titre n'y
 * est JAMAIS deux fois (retour de Damien du 25/10) : une attente dont le jumeau est déjà un favori, ou déjà une
 * autre attente, s'efface (même enregistrement, ou même titre et même artiste : trackTwins.ts).
 */
export function mergeLiked(liked: readonly MusicTrack[], pending: readonly PendingMusicItem[]): ListRow[] {
  const recordings = knownRecordings(liked);
  const keys = new Set(liked.map((t) => t.key));
  const kept: PendingMusicItem[] = [];
  for (const item of [...pending].filter((i) => i.kind === "like").sort((a, b) => a.createdAt - b.createdAt)) {
    if (alreadyThere(item, recordings, keys) || liked.some((t) => sameRecording(t, item.track)) || kept.some((k) => sameRecording(k.track, item.track))) continue;
    kept.push(item);
  }
  const waiting = kept.sort((a, b) => b.createdAt - a.createdAt).map(pendingRow);
  return [...waiting, ...liked.map((track) => ({ rowKey: track.key, track, pending: null, entryId: null }))];
}

/**
 * Une playlist : chaque attente à la position voulue (fin si absente). Une attente d'un IMPORT qui dit son rang dans
 * la source (`sourceIndex`), dans une playlist dont les entrées disent le leur (serveur 1.40.0) : juste après le
 * titre qui la précède dans la source (`sourcePlace`) — sa position, calculée à l'import, devenait fausse à chaque
 * arrivée (27/10, une playlist importée d'Apple Music).
 */
export function mergePlaylist(entries: readonly MusicPlaylistEntry[], pending: readonly PendingMusicItem[], playlistId: string): ListRow[] {
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  const tracks = ordered.map((e) => e.track);
  const recordings = knownRecordings(tracks);
  const keys = new Set(tracks.map((t) => t.key));
  const ranks = ordered.map((e) => (typeof e.sourceIndex === "number" ? e.sourceIndex : null));
  const placeOf = (item: PendingMusicItem): number =>
    (typeof item.sourceIndex === "number" ? sourcePlace(ranks, item.sourceIndex) : null) ?? pendingAsPlaylistEntry(item).position;
  const waiting = pending
    // Un doublon CONFIRMÉ ne se fond pas dans l'entrée existante : il a sa rangée.
    .filter((item) => item.kind === "playlistAdd" && item.playlistId === playlistId && (item.duplicate === true || !alreadyThere(item, recordings, keys)))
    .map((item) => ({ item, entry: { ...pendingAsPlaylistEntry(item), position: placeOf(item) } }))
    .sort((a, b) => a.entry.position - b.entry.position || (a.item.sourceIndex ?? 0) - (b.item.sourceIndex ?? 0) || a.item.createdAt - b.item.createdAt);

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

/**
 * Le titre est-il DÉJÀ dans cette playlist (une entrée, ou un ajout en attente) ? Avant un ajout, Octave demande
 * alors confirmation : un doublon reste permis, jamais par mégarde.
 */
export function playlistHasTrack(entries: readonly MusicPlaylistEntry[], pending: readonly PendingMusicItem[], playlistId: string, track: MusicTrack): boolean {
  if (entries.some((e) => sameRecording(e.track, track))) return true;
  return pending.some((i) => i.kind === "playlistAdd" && i.playlistId === playlistId && (i.externalId === track.external?.id || sameRecording(i.track, track)));
}

/** Les entrées de cette playlist qui portent ce titre (pour le retirer) : celles de Jellyfin, puis les attentes. */
export function playlistOccurrences(
  entries: readonly MusicPlaylistEntry[],
  pending: readonly PendingMusicItem[],
  playlistId: string,
  track: MusicTrack,
): { entryIds: string[]; operationIds: string[] } {
  return {
    entryIds: entries.filter((e) => sameRecording(e.track, track)).map((e) => e.entryId),
    operationIds: pending
      .filter((i) => i.kind === "playlistAdd" && i.playlistId === playlistId && (i.externalId === track.external?.id || sameRecording(i.track, track)))
      .map((i) => i.operationId),
  };
}

/**
 * Le total d'une playlist pour sa CARTE (liste des playlists, étagères) : les titres de Jellyfin (`trackCount`)
 * et ses ajouts encore en attente de l'extension (titres hors bibliothèque, YouTube) — ceux que sa page montre
 * déjà à leur place (`mergePlaylist`). Sans eux, une playlist de 189 titres en annonçait 154 (28/10). La carte
 * n'a pas les entrées : un ajout en attente dont le titre est déjà arrivé dans Jellyfin cesse d'attendre de lui-même.
 */
export function playlistTrackTotal(trackCount: number, pending: readonly PendingMusicItem[], playlistId: string): number {
  return trackCount + pending.filter((i) => i.kind === "playlistAdd" && i.playlistId === playlistId).length;
}
