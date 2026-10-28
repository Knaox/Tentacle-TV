/**
 * Octave — la REPRISE d'une session quittée, pure : ce que l'appareil garde
 * du lecteur en fermant (la file autour du titre en cours, sa position,
 * l'aléatoire et la répétition) et ce qu'il en refait au lancement — le titre
 * dans la barre, EN PAUSE, à sa place, sans rien charger ni rien jouer : le
 * premier « Lecture » le démarre à sa position (`OctavePlayer.restoredAtMs`).
 *
 * Aucune URL de source n'est gardée (signées, éphémères) : seulement les
 * titres tels que les listes les montrent.
 */

import type { MusicTrack } from "../music";
import { currentItem, type QueueItem, type QueueState, type RepeatMode } from "./queueModel";
import type { PlayerSnapshot } from "./playerState";
import type { OctavePlayer } from "./octavePlayer";

/** La file gardée : au plus tant de titres, autour du titre en cours. */
export const RESUME_MAX_TRACKS = 200;
/** Combien de titres déjà passés on garde avant le titre en cours. */
const RESUME_HISTORY = 20;

export interface SavedPlayback {
  v: 1;
  /** L'ordre de LECTURE. */
  tracks: MusicTrack[];
  /** Le titre en cours dans `tracks`. */
  cursor: number;
  /** L'ordre du contexte (indices dans `tracks`), pour quitter l'aléatoire au même endroit. */
  original: number[];
  shuffle: boolean;
  repeat: RepeatMode;
  contextId: string | null;
  positionMs: number;
}

/** Ce qu'on garde d'un instantané (null : rien en cours, rien à garder). */
export function savePlayback(snapshot: PlayerSnapshot, positionMs: number, max: number = RESUME_MAX_TRACKS): SavedPlayback | null {
  const { queue } = snapshot;
  if (!snapshot.current || queue.cursor < 0 || queue.cursor >= queue.items.length) return null;
  const start = Math.max(0, Math.min(queue.cursor - RESUME_HISTORY, queue.items.length - max));
  const kept = queue.items.slice(start, start + max);
  const index = new Map(kept.map((item, i) => [item.uid, i]));
  const original = queue.original.map((uid) => index.get(uid)).filter((i): i is number => i !== undefined);
  return {
    v: 1,
    tracks: kept.map((item) => item.track),
    cursor: queue.cursor - start,
    original,
    shuffle: queue.shuffle,
    repeat: queue.repeat,
    contextId: queue.contextId,
    positionMs: Math.max(0, Math.round(positionMs)),
  };
}

let reviveSeq = 0;

function isTrack(value: unknown): value is MusicTrack {
  const t = value as Partial<MusicTrack> | null;
  return !!t && typeof t === "object" && typeof t.key === "string" && typeof t.title === "string" && Array.isArray(t.artists);
}

/** La file refaite (entrées neuves, jamais un `uid` d'une autre exécution) ; null si la sauvegarde est illisible. */
export function revivePlayback(saved: unknown): { queue: QueueState; positionMs: number } | null {
  const s = saved as Partial<SavedPlayback> | null;
  if (!s || s.v !== 1 || !Array.isArray(s.tracks) || s.tracks.length === 0 || !s.tracks.every(isTrack)) return null;
  const cursor = typeof s.cursor === "number" && Number.isInteger(s.cursor) ? s.cursor : -1;
  if (cursor < 0 || cursor >= s.tracks.length) return null;
  const items: QueueItem[] = s.tracks.map((track) => ({ uid: `r${(reviveSeq += 1).toString(36)}`, track }));
  // Les indices absents de `original` sont la FILE D'ATTENTE de l'utilisateur : elle revient telle quelle. Une
  // sauvegarde sans `original` lisible refait un contexte entier.
  const indices = Array.isArray(s.original) ? [...new Set(s.original.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < items.length))] : [];
  const original = indices.length > 0 ? indices.map((i) => items[i]!.uid) : items.map((item) => item.uid);
  const repeat: RepeatMode = s.repeat === "all" || s.repeat === "one" ? s.repeat : "off";
  const queue: QueueState = { items, original, cursor, shuffle: s.shuffle === true, repeat, contextId: typeof s.contextId === "string" ? s.contextId : null };
  const positionMs = typeof s.positionMs === "number" && Number.isFinite(s.positionMs) ? Math.max(0, s.positionMs) : 0;
  return { queue, positionMs };
}

/**
 * Pose la session reprise dans le lecteur : titre, file, position, EN PAUSE.
 * Sans effet si quelque chose est déjà en cours (un geste a précédé la reprise).
 */
export function restorePlayback(player: OctavePlayer, saved: unknown): boolean {
  const revived = revivePlayback(saved);
  if (!revived || player.snapshot.get().current) return false;
  const item = currentItem(revived.queue);
  if (!item) return false;
  const duration = item.track.durationMs;
  const at = duration !== null && revived.positionMs >= duration ? 0 : revived.positionMs;
  player.restoredAtMs = at;
  player.snapshot.update({ queue: revived.queue, current: item.track, wantsPlay: false, phase: "paused", durationMs: duration, format: item.track.format, origin: null, error: null, notice: null });
  player.position.set({ positionMs: at, durationMs: duration, running: false });
  return true;
}
