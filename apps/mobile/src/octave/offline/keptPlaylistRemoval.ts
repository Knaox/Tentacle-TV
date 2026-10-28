/**
 * Octave (mobile) — un titre retiré d'une playlist GARDÉE quitte l'appareil, sauf
 * s'il est gardé ailleurs (règle pure `planPlaylistRemoval`, offline-core),
 * appliqué au geste sans attendre la tenue à jour (coupée par réglage, ou en
 * attente d'un évènement). Après un délai de grâce : « Annuler » (l'avis du
 * retrait) remet le titre à sa place sans qu'aucun fichier n'ait été effacé.
 * Application quittée pendant la grâce : la tenue à jour le rattrape.
 */

import { libraryPlaylistKey, planPlaylistRemoval } from "@tentacle-tv/offline-core/music";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { keepActions, keptMusicStore } from "./keptMusic";

/** Le temps de l'avis « Retiré de X — Annuler », et un peu plus. */
export const KEPT_REMOVAL_GRACE_MS = 8_000;

interface Waiting {
  timer: ReturnType<typeof setTimeout>;
  stillListed: ReadonlySet<string>;
}

const waiting = new Map<string, Waiting>();
const slot = (playlistId: string, trackKey: string) => `${playlistId}\n${trackKey}`;

async function apply(playlistId: string, trackKey: string, stillListed: ReadonlySet<string>): Promise<void> {
  const state = keptMusicStore.state();
  if (!state.loaded) return;
  const plan = planPlaylistRemoval({
    kept: state.tracks,
    collections: state.collections,
    playlistKey: libraryPlaylistKey(playlistId),
    removedKeys: [trackKey],
    stillListed,
  });
  if (plan.saveCollections.length === 0) return;
  // La collection d'abord : un fichier ne part jamais tant qu'elle le retient.
  await keepActions.saveKeptCollections(plan.saveCollections, plan.removeCollections);
  if (plan.removeFileIds.length > 0) await keepActions.removeKeptFiles(plan.removeFileIds);
  await keptMusicStore.refresh();
}

export function scheduleKeptRemoval(playlistId: string, removed: readonly MusicTrack[], stillListed: ReadonlySet<string>): void {
  for (const track of removed) {
    const key = slot(playlistId, track.key);
    const previous = waiting.get(key);
    if (previous) clearTimeout(previous.timer);
    const timer = setTimeout(() => {
      waiting.delete(key);
      void apply(playlistId, track.key, stillListed).catch(() => undefined);
    }, KEPT_REMOVAL_GRACE_MS);
    waiting.set(key, { timer, stillListed });
  }
}

export function cancelKeptRemoval(playlistId: string, restored: readonly MusicTrack[]): void {
  for (const track of restored) {
    const key = slot(playlistId, track.key);
    const entry = waiting.get(key);
    if (!entry) continue;
    clearTimeout(entry.timer);
    waiting.delete(key);
  }
}
