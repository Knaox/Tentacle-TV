import type { WtAffinityKind } from "../protocol";
import type { Room } from "../roomTypes";
import type { AffinitySession } from "./affinityTypes";

/**
 * Affinité — les séances de chaque salle, en mémoire (comme le chat) : des
 * `WeakMap` sur la salle elle-même, qui partent avec elle. Et le compteur
 * d'états diffusés, monotone par salle, séances comprises — un client ignore
 * tout état plus vieux que celui qu'il tient.
 *
 * Par salle : la séance OUVERTE (celle qu'on swipe), et les séances
 * REFERMÉES — quittées, parties en lecture, ou remplacées par un autre type —,
 * une par type au plus, gardées avec leurs votes : relancer un type rouvre la
 * sienne. Passer des films aux séries puis revenir ne perd rien.
 */

const open = new WeakMap<Room, AffinitySession>();
const closed = new WeakMap<Room, Map<WtAffinityKind, AffinitySession>>();
const seqs = new WeakMap<Room, number>();
let lastSessionId = 0;

export function getAffinity(room: Room): AffinitySession | null {
  return open.get(room) ?? null;
}

export function setAffinity(room: Room, session: AffinitySession | null): void {
  if (session) open.set(room, session);
  else open.delete(room);
}

/** La séance refermée d'un type, gardée pour une reprise. */
export function getClosedAffinity(room: Room, kind: WtAffinityKind): AffinitySession | null {
  return closed.get(room)?.get(kind) ?? null;
}

/** Les séances refermées de la salle, une par type. */
export function closedAffinities(room: Room): AffinitySession[] {
  return [...(closed.get(room)?.values() ?? [])];
}

/** Garde une séance refermée — à la place de celle de son type. */
export function keepClosedAffinity(room: Room, session: AffinitySession): void {
  const byKind = closed.get(room) ?? new Map<WtAffinityKind, AffinitySession>();
  byKind.set(session.kind, session);
  closed.set(room, byKind);
}

/** Retire la séance refermée d'un type (elle rouvre), ou toutes (`kind` omis). */
export function dropClosedAffinity(room: Room, kind?: WtAffinityKind): void {
  if (kind) closed.get(room)?.delete(kind);
  else closed.delete(room);
}

/** Identifiant de séance, unique pour la vie du serveur. */
export function nextSessionId(): number {
  return ++lastSessionId;
}

/** Le numéro du prochain état diffusé. */
export function bumpAffinitySeq(room: Room): number {
  const next = (seqs.get(room) ?? 0) + 1;
  seqs.set(room, next);
  return next;
}

/** Le numéro du dernier état diffusé (lecture REST, sans diffusion). */
export function currentAffinitySeq(room: Room): number {
  return seqs.get(room) ?? 0;
}
