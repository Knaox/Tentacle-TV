/**
 * Octave — la FILE de lecture, pure (aucun React, aucun moteur).
 *
 * Contrat (musicPlayback.ts) : le moteur ne connaît que le titre courant et le
 * suivant ; l'ordre, l'aléatoire et la répétition vivent ICI. Chaque entrée a
 * un `uid` à elle : un même titre peut figurer deux fois dans la file, et une
 * entrée se retire ou se déplace sans ambiguïté.
 *
 * `items` est l'ordre de LECTURE ; `original` garde l'ordre du contexte (album,
 * playlist) pour revenir de l'aléatoire au même endroit. Une entrée absente de
 * `original` est de la FILE D'ATTENTE de l'utilisateur : ses gestes et sa règle
 * (toujours avant la suite du contexte) vivent dans `queueFiles.ts`.
 *
 * Un titre INDISPONIBLE (`unavailableTrack.ts`) reste dans la file, grisé, mais n'y est jamais lu : départ, fin du
 * titre, « Suivant », « Précédent » passent par-dessus.
 */

import type { MusicTrack } from "../music";
import { shuffled, wrapTracks } from "./queueEntries";
import { userQueueFirst, wrapToStart } from "./queueFiles";
import { isTrackUnavailable } from "./unavailableTrack";

const playable = (item: QueueItem | null | undefined): item is QueueItem => !!item && !isTrackUnavailable(item.track);

export type RepeatMode = "off" | "all" | "one";

export interface QueueItem {
  uid: string;
  track: MusicTrack;
}

export interface QueueState {
  items: readonly QueueItem[];
  /** Les `uid` dans l'ordre du contexte (hors aléatoire). */
  original: readonly string[];
  /** L'entrée courante dans `items`, -1 pour une file vide. */
  cursor: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** D'où vient la file (`album:<id>`, `playlist:<id>`, `liked`, `search`…). */
  contextId: string | null;
}

/** Tirage injecté (tests déterministes) : rend un réel dans [0, 1). */
export type Random = () => number;

export const EMPTY_QUEUE: QueueState = { items: [], original: [], cursor: -1, shuffle: false, repeat: "off", contextId: null };

/** Au-delà, « Précédent » revient au début du titre au lieu de changer de titre. */
export const RESTART_THRESHOLD_MS = 3_000;

/** Fisher-Yates (réexporté : `queueEntries`). */
export { shuffled } from "./queueEntries";
export {
  carryUserQueue,
  clearUserQueue,
  enqueue,
  followWith,
  isUserEntry,
  jumpTo,
  moveUpcoming,
  playNext,
  queueSections,
  setShuffle,
  userQueueFirst,
  type QueueSections,
} from "./queueFiles";

export interface CreateQueueOptions {
  shuffle?: boolean;
  repeat?: RepeatMode;
  contextId?: string | null;
  random?: Random;
}

/** Une file née d'une liste, lue à partir de `startIndex` (en aléatoire : ce titre d'abord). */
export function createQueue(tracks: readonly MusicTrack[], startIndex: number, options: CreateQueueOptions = {}): QueueState {
  if (tracks.length === 0) return { ...EMPTY_QUEUE, repeat: options.repeat ?? "off", shuffle: options.shuffle ?? false };
  const items = wrapTracks(tracks);
  const start = firstPlayableFrom(items, Math.min(Math.max(0, startIndex), tracks.length - 1));
  const original = items.map((item) => item.uid);
  const shuffle = options.shuffle ?? false;
  const base: Omit<QueueState, "items" | "cursor"> = {
    original,
    shuffle,
    repeat: options.repeat ?? "off",
    contextId: options.contextId ?? null,
  };
  if (!shuffle) return { ...base, items, cursor: start };
  const first = items[start] as QueueItem;
  const rest = shuffled(items.filter((_, i) => i !== start), options.random ?? Math.random);
  return { ...base, items: [first, ...rest], cursor: 0 };
}

/** Le premier titre lisible à partir de `start` (puis depuis le début) ; aucun : `start`, tel quel. */
function firstPlayableFrom(items: readonly QueueItem[], start: number): number {
  for (let i = 0; i < items.length; i += 1) {
    const index = (start + i) % items.length;
    if (playable(items[index])) return index;
  }
  return start;
}

export function currentItem(q: QueueState): QueueItem | null {
  return q.items[q.cursor] ?? null;
}

/**
 * L'entrée qui suit. `auto` : la fin naturelle du titre — la répétition d'un
 * titre le rejoue. Un geste (« Suivant ») passe toujours au titre d'après.
 */
export function peekNext(q: QueueState, auto: boolean): QueueItem | null {
  const moved = advance(q, auto);
  return moved ? currentItem(moved) : null;
}

/** Avance jusqu'à la prochaine entrée LISIBLE ; `null` à la fin de la file (rien à lire après). */
export function advance(q: QueueState, auto: boolean): QueueState | null {
  if (q.cursor < 0) return null;
  if (auto && q.repeat === "one" && playable(currentItem(q))) return q;
  let state = q;
  // Au plus un tour complet (et le rebouclage) : une file sans rien de lisible s'arrête.
  for (let step = 0; step <= q.items.length; step += 1) {
    const moved = stepForward(state);
    if (!moved) return null;
    if (playable(currentItem(moved))) return moved;
    state = moved;
  }
  return null;
}

function stepForward(q: QueueState): QueueState | null {
  if (q.cursor + 1 < q.items.length) return { ...q, cursor: q.cursor + 1 };
  return q.repeat === "off" ? null : wrapToStart(q);
}

export type PreviousOutcome = { kind: "restart" } | { kind: "moved"; queue: QueueState };

/** « Précédent » : au début du titre s'il a déjà joué, sinon le titre d'avant. */
export function previous(q: QueueState, positionMs: number): PreviousOutcome {
  if (q.cursor < 0 || positionMs > RESTART_THRESHOLD_MS) return { kind: "restart" };
  // Le titre lisible d'avant (un indisponible se saute) ; la file d'attente reste devant : revenu en arrière, elle se
  // lit encore avant la suite du contexte.
  const before = lastPlayable(q.items, q.cursor - 1, 0);
  if (before >= 0) return { kind: "moved", queue: userQueueFirst({ ...q, cursor: before }) };
  const last = q.repeat === "all" ? lastPlayable(q.items, q.items.length - 1, q.cursor + 1) : -1;
  if (last >= 0) return { kind: "moved", queue: { ...q, cursor: last } };
  return { kind: "restart" };
}

function lastPlayable(items: readonly QueueItem[], from: number, to: number): number {
  for (let i = from; i >= to; i -= 1) if (playable(items[i])) return i;
  return -1;
}

/** Ce qui reste à lire, dans l'ordre (sans le courant). */
export function upcoming(q: QueueState): readonly QueueItem[] {
  return q.cursor < 0 ? [] : q.items.slice(q.cursor + 1);
}

/** Ce qui a déjà été lu, dans l'ordre. */
export function history(q: QueueState): readonly QueueItem[] {
  return q.cursor < 0 ? [] : q.items.slice(0, q.cursor);
}

export function cycleRepeat(mode: RepeatMode): RepeatMode {
  return mode === "off" ? "all" : mode === "all" ? "one" : "off";
}

/** Retire une entrée à venir (le courant ne se retire pas : on passe au suivant). */
export function removeItem(q: QueueState, uid: string): QueueState {
  const index = q.items.findIndex((item) => item.uid === uid);
  if (index < 0 || index === q.cursor) return q;
  const items = q.items.filter((item) => item.uid !== uid);
  return { ...q, items, original: q.original.filter((u) => u !== uid), cursor: index < q.cursor ? q.cursor - 1 : q.cursor };
}

/**
 * La radio SANS FIN (G3) : les titres d'une page suivante s'ajoutent au BOUT de la file, sans ceux qu'elle porte
 * déjà (une page suivante peut redire les précédentes, et un titre déjà écouté ne revient pas). Sans effet si la
 * file n'est plus celle de cette radio (`contextId`) : l'utilisateur a lancé autre chose.
 */
export function extendWith(q: QueueState, contextId: string, tracks: readonly MusicTrack[]): QueueState {
  if (q.cursor < 0 || q.contextId !== contextId) return q;
  const known = new Set(q.items.map((item) => item.track.key));
  const fresh = tracks.filter((track) => {
    if (known.has(track.key)) return false;
    known.add(track.key);
    return true;
  });
  if (fresh.length === 0) return q;
  const added = wrapTracks(fresh);
  return { ...q, items: [...q.items, ...added], original: [...q.original, ...added.map((i) => i.uid)] };
}

/**
 * Un titre a changé de nature (en attente → bibliothèque, `music:resolved`) :
 * toutes ses entrées prennent le nouveau titre, à la même place.
 */
export function replaceTrack(q: QueueState, matches: (track: MusicTrack) => boolean, next: MusicTrack): QueueState {
  let changed = false;
  const items = q.items.map((item) => {
    if (!matches(item.track)) return item;
    changed = true;
    return { uid: item.uid, track: next };
  });
  return changed ? { ...q, items } : q;
}

/** Patch d'un champ d'un titre partout dans la file (favori, disponibilité). */
export function patchTracks(q: QueueState, key: string, patch: Partial<MusicTrack>): QueueState {
  return replaceTrackWhere(q, key, (track) => ({ ...track, ...patch }));
}

function replaceTrackWhere(q: QueueState, key: string, update: (track: MusicTrack) => MusicTrack): QueueState {
  let changed = false;
  const items = q.items.map((item) => {
    if (item.track.key !== key) return item;
    changed = true;
    return { uid: item.uid, track: update(item.track) };
  });
  return changed ? { ...q, items } : q;
}
