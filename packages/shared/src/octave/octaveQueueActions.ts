/**
 * Octave — les gestes sur la file (aléatoire, répétition, « Lire ensuite »,
 * retrait, déplacement, saut, « Réessayer »). Chacun change la file, puis redit
 * au moteur quel est le SUIVANT : le moteur ne connaît jamais que courant + suivant.
 */

import type { MusicTrack } from "../music";
import {
  createQueue,
  cycleRepeat,
  enqueue,
  followWith,
  jumpTo,
  moveUpcoming,
  patchTracks,
  playNext,
  removeItem,
  setShuffle,
  type QueueState,
} from "./queueModel";
import type { OctavePlayer } from "./octavePlayer";

function apply(player: OctavePlayer, queue: QueueState): void {
  const before = player.snapshot.get().queue;
  if (queue === before) return;
  player.snapshot.update({ queue });
  player.scheduleNext();
}

export const queueActions = {
  /** « Aléatoire » d'une tête de liste : l'aléatoire s'allume, un titre au hasard ouvre la file. */
  playShuffled(player: OctavePlayer, tracks: readonly MusicTrack[], contextId: string): void {
    if (tracks.length === 0) return;
    const q = player.snapshot.get().queue;
    if (!q.shuffle) player.snapshot.update({ queue: { ...q, shuffle: true } });
    player.playList(tracks, Math.floor(player.random() * tracks.length), contextId);
  },

  toggleShuffle(player: OctavePlayer): void {
    const q = player.snapshot.get().queue;
    apply(player, setShuffle(q, !q.shuffle, player.random));
  },

  cycleRepeat(player: OctavePlayer): void {
    const q = player.snapshot.get().queue;
    apply(player, { ...q, repeat: cycleRepeat(q.repeat) });
  },

  playNext(player: OctavePlayer, tracks: readonly MusicTrack[]): void {
    const q = player.snapshot.get().queue;
    if (q.cursor < 0) {
      player.playList(tracks, 0, null);
      return;
    }
    apply(player, playNext(q, tracks));
  },

  enqueue(player: OctavePlayer, tracks: readonly MusicTrack[]): void {
    const q = player.snapshot.get().queue;
    if (q.cursor < 0) {
      player.startItem(createQueue(tracks, 0, { shuffle: q.shuffle, repeat: q.repeat }), 0);
      return;
    }
    apply(player, enqueue(q, tracks));
  },

  remove(player: OctavePlayer, uid: string): void {
    apply(player, removeItem(player.snapshot.get().queue, uid));
  },

  move(player: OctavePlayer, uid: string, toUpcomingIndex: number): void {
    apply(player, moveUpcoming(player.snapshot.get().queue, uid, toUpcomingIndex));
  },

  /** La suite du titre `uid` devient `tracks` (la radio d'un clic de recherche), s'il est encore le courant. */
  followWith(player: OctavePlayer, uid: string, tracks: readonly MusicTrack[], contextId: string): void {
    apply(player, followWith(player.snapshot.get().queue, uid, tracks, contextId));
  },

  /** « Réessayer » : le titre courant, redemandé de zéro à l'extension — un geste, jamais sauté. */
  retry(player: OctavePlayer): void {
    const snap = player.snapshot.get();
    if (!snap.current) return;
    player.deps.sources.invalidate(snap.current.key);
    player.startItem(snap.queue, 0, "chosen", "retry");
  },

  /** Clic sur une entrée de la file : elle devient le courant. */
  jumpTo(player: OctavePlayer, uid: string): void {
    const q = player.snapshot.get().queue;
    const next = jumpTo(q, uid);
    if (next !== q) player.startItem(next, 0);
  },

  /** Un favori a changé (cœur, autre client) : la barre et la file le montrent. */
  patchFavorite(player: OctavePlayer, key: string, favorite: boolean): void {
    const snap = player.snapshot.get();
    const queue = patchTracks(snap.queue, key, { favorite });
    const current = snap.current?.key === key ? { ...snap.current, favorite } : snap.current;
    if (queue !== snap.queue || current !== snap.current) player.snapshot.update({ queue, current });
  },
};
