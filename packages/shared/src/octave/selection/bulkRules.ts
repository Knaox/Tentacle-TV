/**
 * Octave — les gestes GROUPÉS sur une sélection, règles pures :
 * - ajouter à une playlist : même règle de doublon qu'un titre seul (jamais par mégarde) — les titres déjà dans la
 *   playlist sont comptés, et l'utilisateur choisit : tous, sans les doublons, ou rien ;
 * - aimer : les titres pas encore aimés le deviennent ; si TOUS l'étaient déjà, le geste les retire des likés ;
 * - un titre que le geste ne sait pas faire (`can…`) est laissé de côté, jamais une erreur.
 */

import type { MusicPlaylistEntry, MusicTrack, PendingMusicItem } from "../../music";
import { playlistHasTrack } from "../pendingMerge";

export type DuplicateChoice = "all" | "skip" | "cancel";

export interface BulkAddPlan {
  fresh: MusicTrack[];
  duplicates: MusicTrack[];
}

export function bulkAddPlan(
  tracks: readonly MusicTrack[],
  entries: readonly MusicPlaylistEntry[],
  pending: readonly PendingMusicItem[],
  playlistId: string,
  canAdd: (track: MusicTrack) => boolean,
): BulkAddPlan {
  const plan: BulkAddPlan = { fresh: [], duplicates: [] };
  for (const track of tracks) {
    if (!canAdd(track)) continue;
    (playlistHasTrack(entries, pending, playlistId, track) ? plan.duplicates : plan.fresh).push(track);
  }
  return plan;
}

/** Ce qui entre vraiment, selon le choix fait devant les doublons (`null` : rien, le geste est abandonné). */
export function tracksToAdd(plan: BulkAddPlan, choice: DuplicateChoice): { track: MusicTrack; duplicate: boolean }[] | null {
  if (choice === "cancel") return null;
  const fresh = plan.fresh.map((track) => ({ track, duplicate: false }));
  return choice === "all" ? [...fresh, ...plan.duplicates.map((track) => ({ track, duplicate: true }))] : fresh;
}

export interface LikePlan {
  /** Ce que deviennent les titres : aimés, ou retirés des likés. */
  liked: boolean;
  tracks: MusicTrack[];
}

export function bulkLikePlan(tracks: readonly MusicTrack[], isLiked: (track: MusicTrack) => boolean, canLike: (track: MusicTrack) => boolean): LikePlan {
  const able = tracks.filter(canLike);
  const notYet = able.filter((t) => !isLiked(t));
  return notYet.length > 0 ? { liked: true, tracks: notYet } : { liked: false, tracks: able };
}
