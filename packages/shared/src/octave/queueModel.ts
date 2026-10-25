/**
 * Octave — la FILE de lecture, pure (aucun React, aucun moteur).
 *
 * Contrat (musicPlayback.ts) : le moteur ne connaît que le titre courant et le
 * suivant ; l'ordre, l'aléatoire et la répétition vivent ICI. Chaque entrée a
 * un `uid` à elle : un même titre peut figurer deux fois dans la file, et une
 * entrée se retire ou se déplace sans ambiguïté.
 *
 * `items` est l'ordre de LECTURE ; `original` garde l'ordre du contexte (album,
 * playlist) pour revenir de l'aléatoire au même endroit.
 */

import type { MusicTrack } from "../music";

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

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return `q${uidSeq.toString(36)}`;
}

function wrap(tracks: readonly MusicTrack[]): QueueItem[] {
  return tracks.map((track) => ({ uid: nextUid(), track }));
}

/** Fisher-Yates, sur une copie. */
export function shuffled<T>(list: readonly T[], random: Random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export interface CreateQueueOptions {
  shuffle?: boolean;
  repeat?: RepeatMode;
  contextId?: string | null;
  random?: Random;
}

/** Une file née d'une liste, lue à partir de `startIndex` (en aléatoire : ce titre d'abord). */
export function createQueue(tracks: readonly MusicTrack[], startIndex: number, options: CreateQueueOptions = {}): QueueState {
  if (tracks.length === 0) return { ...EMPTY_QUEUE, repeat: options.repeat ?? "off", shuffle: options.shuffle ?? false };
  const start = Math.min(Math.max(0, startIndex), tracks.length - 1);
  const items = wrap(tracks);
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

export function currentItem(q: QueueState): QueueItem | null {
  return q.items[q.cursor] ?? null;
}

/**
 * L'entrée qui suit. `auto` : la fin naturelle du titre — la répétition d'un
 * titre le rejoue. Un geste (« Suivant ») passe toujours au titre d'après.
 */
export function peekNext(q: QueueState, auto: boolean): QueueItem | null {
  if (q.cursor < 0) return null;
  if (auto && q.repeat === "one") return currentItem(q);
  const after = q.items[q.cursor + 1];
  if (after) return after;
  return q.repeat === "all" || (q.repeat === "one" && !auto) ? (q.items[0] ?? null) : null;
}

/** Avance d'une entrée ; `null` à la fin de la file (rien à lire après). */
export function advance(q: QueueState, auto: boolean): QueueState | null {
  if (q.cursor < 0) return null;
  if (auto && q.repeat === "one") return q;
  if (q.cursor + 1 < q.items.length) return { ...q, cursor: q.cursor + 1 };
  return q.repeat === "off" ? null : { ...q, cursor: 0 };
}

export type PreviousOutcome = { kind: "restart" } | { kind: "moved"; queue: QueueState };

/** « Précédent » : au début du titre s'il a déjà joué, sinon le titre d'avant. */
export function previous(q: QueueState, positionMs: number): PreviousOutcome {
  if (q.cursor < 0 || positionMs > RESTART_THRESHOLD_MS) return { kind: "restart" };
  if (q.cursor > 0) return { kind: "moved", queue: { ...q, cursor: q.cursor - 1 } };
  if (q.repeat === "all" && q.items.length > 1) return { kind: "moved", queue: { ...q, cursor: q.items.length - 1 } };
  return { kind: "restart" };
}

/** Ce qui reste à lire, dans l'ordre (sans le courant). */
export function upcoming(q: QueueState): readonly QueueItem[] {
  return q.cursor < 0 ? [] : q.items.slice(q.cursor + 1);
}

/** Ce qui a déjà été lu, dans l'ordre. */
export function history(q: QueueState): readonly QueueItem[] {
  return q.cursor < 0 ? [] : q.items.slice(0, q.cursor);
}

/**
 * Aléatoire : allumé, le courant reste en tête et la suite est battue ;
 * éteint, l'ordre du contexte revient, au même titre.
 */
export function setShuffle(q: QueueState, on: boolean, random: Random = Math.random): QueueState {
  if (on === q.shuffle) return q;
  const current = currentItem(q);
  if (!current) return { ...q, shuffle: on };
  if (on) {
    // L'historique reste tel qu'il a été lu ; seule la suite est battue.
    const rest = shuffled(q.items.slice(q.cursor + 1), random);
    return { ...q, shuffle: true, items: [...q.items.slice(0, q.cursor + 1), ...rest] };
  }
  const byUid = new Map(q.items.map((item) => [item.uid, item]));
  const ordered = q.original.map((uid) => byUid.get(uid)).filter((item): item is QueueItem => item !== undefined);
  // Les entrées ajoutées hors contexte (« Lire ensuite ») gardent leur place relative, après.
  const extras = q.items.filter((item) => !q.original.includes(item.uid));
  const items = [...ordered, ...extras];
  return { ...q, shuffle: false, items, cursor: Math.max(0, items.findIndex((item) => item.uid === current.uid)) };
}

export function cycleRepeat(mode: RepeatMode): RepeatMode {
  return mode === "off" ? "all" : mode === "all" ? "one" : "off";
}

/** « Lire ensuite » : juste après le courant. */
export function playNext(q: QueueState, tracks: readonly MusicTrack[]): QueueState {
  const added = wrap(tracks);
  if (q.cursor < 0) return { ...q, items: added, original: added.map((i) => i.uid), cursor: added.length ? 0 : -1 };
  const items = [...q.items.slice(0, q.cursor + 1), ...added, ...q.items.slice(q.cursor + 1)];
  return { ...q, items };
}

/** « Ajouter à la file » : à la fin. */
export function enqueue(q: QueueState, tracks: readonly MusicTrack[]): QueueState {
  const added = wrap(tracks);
  if (q.cursor < 0) return { ...q, items: added, original: added.map((i) => i.uid), cursor: added.length ? 0 : -1 };
  return { ...q, items: [...q.items, ...added] };
}

/** Retire une entrée à venir (le courant ne se retire pas : on passe au suivant). */
export function removeItem(q: QueueState, uid: string): QueueState {
  const index = q.items.findIndex((item) => item.uid === uid);
  if (index < 0 || index === q.cursor) return q;
  const items = q.items.filter((item) => item.uid !== uid);
  return { ...q, items, original: q.original.filter((u) => u !== uid), cursor: index < q.cursor ? q.cursor - 1 : q.cursor };
}

/** Déplace une entrée à venir à la place `toUpcomingIndex` de la suite (0 = juste après le courant). */
export function moveUpcoming(q: QueueState, uid: string, toUpcomingIndex: number): QueueState {
  const from = q.items.findIndex((item) => item.uid === uid);
  if (from <= q.cursor) return q;
  const items = [...q.items];
  const [moved] = items.splice(from, 1);
  const target = Math.min(Math.max(q.cursor + 1, q.cursor + 1 + toUpcomingIndex), items.length);
  items.splice(target, 0, moved as QueueItem);
  return { ...q, items };
}

/**
 * La SUITE d'un titre (S3 du plan de R8 : la radio de YouTube Music après un clic de recherche) : tout ce qui
 * suivait l'entrée `uid` est remplacé par `tracks` (le titre lui-même écarté), l'historique reste, la file prend
 * le contexte `contextId`. Sans effet si `uid` n'est plus le courant : l'utilisateur est passé à autre chose.
 */
export function followWith(q: QueueState, uid: string, tracks: readonly MusicTrack[], contextId: string): QueueState {
  const current = currentItem(q);
  if (!current || current.uid !== uid) return q;
  const added = wrap(tracks.filter((t) => t.key !== current.track.key));
  if (added.length === 0) return q;
  const head = q.items.slice(0, q.cursor + 1);
  return { ...q, items: [...head, ...added], original: [...head.map((i) => i.uid), ...added.map((i) => i.uid)], contextId };
}

/** Saute à une entrée (clic dans la file). */
export function jumpTo(q: QueueState, uid: string): QueueState {
  const index = q.items.findIndex((item) => item.uid === uid);
  return index < 0 ? q : { ...q, cursor: index };
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
