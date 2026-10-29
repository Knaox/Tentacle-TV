/**
 * Octave — les DEUX FILES (lot op, o3) : la file d'attente de l'utilisateur et la
 * file du contexte (l'album, la playlist, la radio qui joue). Une seule liste de
 * lecture (`items`) les porte ; une entrée est « de l'utilisateur » quand elle
 * n'est PAS dans `original` (l'ordre du contexte) — « Lire ensuite » et « Ajouter
 * à la file d'attente » ne l'y mettent jamais.
 *
 * La règle, partout (bureau, mobile, en ligne, hors ligne — les moteurs ne font
 * qu'appliquer) : après le titre en cours vient TOUJOURS la file d'attente, puis
 * la suite du contexte.
 * - « Lire ensuite » : en TÊTE de la file d'attente ; le dernier demandé passe
 *   devant les précédents.
 * - « Ajouter à la file d'attente » : au BOUT de la file d'attente, donc encore
 *   avant la suite du contexte.
 * - Un nouveau contexte lancé (un album, une playlist) GARDE la file d'attente,
 *   qui passe avant sa suite ; « Effacer » la vide.
 * - L'aléatoire ne bat que la suite du contexte, jamais la file d'attente.
 * - Une entrée ne se déplace que dans SA file.
 * - Sauter à une entrée (clic dans la file) ne jette jamais la file d'attente :
 *   ce qu'elle avait devant reste à lire juste après.
 * - « Tout répéter » reboucle sur le contexte seul : une entrée de la file
 *   d'attente se lit une fois.
 */

import type { MusicTrack } from "../music";
import type { QueueItem, QueueState, Random } from "./queueModel";
import { shuffled, wrapTracks } from "./queueEntries";

export interface QueueSections {
  /** Le titre en cours. */
  current: QueueItem | null;
  /** La file d'attente de l'utilisateur, dans l'ordre où elle se lira. */
  userQueue: readonly QueueItem[];
  /** La suite du contexte (album, playlist…), après la file d'attente. */
  contextQueue: readonly QueueItem[];
}

function contextSet(q: QueueState): ReadonlySet<string> {
  return new Set(q.original);
}

/** Vrai pour une entrée mise par l'utilisateur (« Lire ensuite », « Ajouter à la file d'attente »). */
export function isUserEntry(q: QueueState, uid: string): boolean {
  return q.items.some((item) => item.uid === uid) && !q.original.includes(uid);
}

function split(q: QueueState): { user: QueueItem[]; context: QueueItem[] } {
  const ctx = contextSet(q);
  const after = q.cursor < 0 ? [] : q.items.slice(q.cursor + 1);
  return { user: after.filter((item) => !ctx.has(item.uid)), context: after.filter((item) => ctx.has(item.uid)) };
}

/** Ce qui reste à lire, rangé en deux files. */
export function queueSections(q: QueueState): QueueSections {
  const { user, context } = split(q);
  return { current: q.items[q.cursor] ?? null, userQueue: user, contextQueue: context };
}

/** La suite refaite : l'historique et le courant, puis la file d'attente, puis le contexte. */
function rebuild(q: QueueState, user: readonly QueueItem[], context: readonly QueueItem[]): QueueState {
  return { ...q, items: [...q.items.slice(0, q.cursor + 1), ...user, ...context] };
}

/** Remet la file d'attente devant la suite du contexte (après un retour en arrière, par exemple). */
export function userQueueFirst(q: QueueState): QueueState {
  if (q.cursor < 0) return q;
  const { user, context } = split(q);
  const same = user.every((item, i) => q.items[q.cursor + 1 + i] === item);
  return same ? q : rebuild(q, user, context);
}

/** Une file sans courant : les titres deviennent le contexte, le premier se lit. */
function fresh(q: QueueState, added: QueueItem[]): QueueState {
  return { ...q, items: added, original: added.map((i) => i.uid), cursor: added.length ? 0 : -1 };
}

/** « Lire ensuite » : en tête de la file d'attente (les titres d'un même geste gardent leur ordre). */
export function playNext(q: QueueState, tracks: readonly MusicTrack[]): QueueState {
  const added = wrapTracks(tracks);
  if (q.cursor < 0) return fresh(q, added);
  if (added.length === 0) return q;
  const { user, context } = split(q);
  return rebuild(q, [...added, ...user], context);
}

/** « Ajouter à la file d'attente » : au bout de la file d'attente, avant la suite du contexte. */
export function enqueue(q: QueueState, tracks: readonly MusicTrack[]): QueueState {
  const added = wrapTracks(tracks);
  if (q.cursor < 0) return fresh(q, added);
  if (added.length === 0) return q;
  const { user, context } = split(q);
  return rebuild(q, [...user, ...added], context);
}

/** « Effacer la file d'attente » : la suite du contexte reprend juste après le courant. */
export function clearUserQueue(q: QueueState): QueueState {
  const { user, context } = split(q);
  return user.length === 0 ? q : rebuild(q, [], context);
}

/**
 * Un nouveau contexte lancé (`next`, né de `createQueue`) : la file d'attente encore à lire de `prev` passe juste
 * après son titre, avant sa suite.
 */
export function carryUserQueue(prev: QueueState, next: QueueState): QueueState {
  const { user } = split(prev);
  if (user.length === 0 || next.cursor < 0) return next;
  const { context } = split(next);
  return rebuild(next, user, context);
}

/**
 * Aléatoire : allumé, l'historique, le courant et la file d'attente restent, seule la suite du contexte est battue ;
 * éteint, le contexte reprend son ordre au titre en cours (ou au dernier titre du contexte lu avant lui), la file
 * d'attente toujours devant.
 */
export function setShuffle(q: QueueState, on: boolean, random: Random = Math.random): QueueState {
  if (on === q.shuffle) return q;
  const current = q.items[q.cursor];
  if (!current) return { ...q, shuffle: on };
  const ctx = contextSet(q);
  if (on) {
    const { user, context } = split(q);
    return { ...rebuild(q, user, shuffled(context, random)), shuffle: true };
  }
  const byUid = new Map(q.items.map((item) => [item.uid, item]));
  const ordered = q.original.map((uid) => byUid.get(uid)).filter((item): item is QueueItem => item !== undefined);
  const played = q.items.slice(0, q.cursor);
  // L'ancre : le courant s'il est du contexte, sinon le dernier titre du contexte déjà lu.
  const anchorUid = ctx.has(current.uid) ? current.uid : [...played].reverse().find((item) => ctx.has(item.uid))?.uid;
  const anchor = anchorUid ? ordered.findIndex((item) => item.uid === anchorUid) : -1;
  const head = ordered.slice(0, ctx.has(current.uid) ? anchor : anchor + 1);
  const playedUser = played.filter((item) => !ctx.has(item.uid));
  const { user } = split(q);
  const items = [...head, ...playedUser, current, ...user, ...ordered.slice(anchor + 1)];
  return { ...q, shuffle: false, items, cursor: head.length + playedUser.length };
}

/** Déplace une entrée à venir à la place `toIndex` de SA file (0 = en tête de la file d'attente, ou du contexte). */
export function moveUpcoming(q: QueueState, uid: string, toIndex: number): QueueState {
  const { user, context } = split(q);
  const list = user.some((item) => item.uid === uid) ? user : context.some((item) => item.uid === uid) ? context : null;
  if (!list) return q;
  const from = list.findIndex((item) => item.uid === uid);
  const target = Math.min(Math.max(0, toIndex), list.length - 1);
  if (target === from) return q;
  const [moved] = list.splice(from, 1);
  list.splice(target, 0, moved as QueueItem);
  return rebuild(q, user, context);
}

/**
 * Saute à une entrée (clic dans la file). Vers l'avant : les titres du contexte passés deviennent l'historique, la
 * file d'attente qu'on a sautée reste à lire juste après. Vers l'arrière : le titre revient, la file d'attente devant.
 */
export function jumpTo(q: QueueState, uid: string): QueueState {
  const index = q.items.findIndex((item) => item.uid === uid);
  if (index < 0 || index === q.cursor) return index < 0 ? q : { ...q, cursor: index };
  if (index < q.cursor) return userQueueFirst({ ...q, cursor: index });
  const ctx = contextSet(q);
  const skipped = q.items.slice(q.cursor + 1, index);
  const skippedUser = skipped.filter((item) => !ctx.has(item.uid));
  const skippedContext = skipped.filter((item) => ctx.has(item.uid));
  const head = [...q.items.slice(0, q.cursor + 1), ...skippedContext];
  const target = q.items[index] as QueueItem;
  return userQueueFirst({ ...q, items: [...head, target, ...skippedUser, ...q.items.slice(index + 1)], cursor: head.length });
}

/**
 * La SUITE d'un titre (S3 du plan de R8 : la radio de YouTube Music après un clic de recherche) : la suite du
 * contexte est remplacée par `tracks` (le titre lui-même écarté), la file d'attente reste devant, l'historique reste,
 * la file prend le contexte `contextId`. Sans effet si `uid` n'est plus le courant.
 */
export function followWith(q: QueueState, uid: string, tracks: readonly MusicTrack[], contextId: string): QueueState {
  const current = q.items[q.cursor];
  if (!current || current.uid !== uid) return q;
  const added = wrapTracks(tracks.filter((t) => t.key !== current.track.key));
  if (added.length === 0) return q;
  const ctx = contextSet(q);
  const head = q.items.slice(0, q.cursor + 1);
  const { user } = split(q);
  const original = [...head.filter((item) => ctx.has(item.uid)).map((i) => i.uid), ...added.map((i) => i.uid)];
  return { ...q, items: [...head, ...user, ...added], original, contextId };
}

/**
 * « Tout répéter » au bout de la file : on reboucle sur le CONTEXTE seul (la file d'attente s'est lue une fois).
 * Une file faite de la seule file d'attente reboucle entière.
 */
export function wrapToStart(q: QueueState): QueueState {
  const ctx = contextSet(q);
  const items = q.items.filter((item) => ctx.has(item.uid));
  return items.length === 0 ? { ...q, cursor: 0 } : { ...q, items, cursor: 0 };
}
