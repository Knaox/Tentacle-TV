/**
 * Octave — un titre RETIRÉ d'une playlist gardée quitte l'appareil, SAUF si
 * quelque chose d'autre le garde : une autre playlist gardée (« Titres likés »
 * compris), un album gardé, ou le titre gardé seul. Règle PURE
 * (`playlistRemoval.test.ts`), appliquée AU GESTE par la plateforme — sans
 * attendre la tenue à jour (qui peut être coupée, ou hors ligne) : la
 * collection perd le titre, puis ses fichiers partent s'il n'est plus retenu.
 *
 * Un titre encore présent dans la playlist (doublon dont une seule occurrence
 * part) reste : `stillListed` le dit.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import { isHeld, type SyncActions } from "./syncPlan";

/** La clé de collection d'une playlist de la bibliothèque gardée. */
export const libraryPlaylistKey = (playlistId: string): string => `playlist:jf:${playlistId}`;

export interface PlaylistRemovalInput {
  kept: readonly KeptMusicTrack[];
  collections: readonly KeptMusicCollection[];
  playlistKey: string;
  removedKeys: readonly string[];
  /** Les titres qui restent dans la playlist après le geste (s'ils sont connus). */
  stillListed?: ReadonlySet<string>;
}

const NOTHING: SyncActions = { keep: [], removeFileIds: [], saveCollections: [], removeCollections: [] };

export function planPlaylistRemoval(input: PlaylistRemovalInput): SyncActions {
  const playlist = input.collections.find((c) => c.key === input.playlistKey && c.kind === "playlist");
  if (!playlist) return NOTHING;
  const gone = new Set(input.removedKeys.filter((k) => playlist.trackKeys.includes(k) && !input.stillListed?.has(k)));
  if (gone.size === 0) return NOTHING;
  const updated: KeptMusicCollection = { ...playlist, trackKeys: playlist.trackKeys.filter((k) => !gone.has(k)) };
  const after = input.collections.map((c) => (c.key === updated.key ? updated : c));
  const removeFileIds: number[] = [];
  for (const key of gone) {
    if (isHeld(key, after)) continue;
    for (const f of input.kept) if (f.trackKey === key && f.status !== "canceled") removeFileIds.push(f.fileId);
  }
  return { keep: [], removeFileIds, saveCollections: [updated], removeCollections: [] };
}
