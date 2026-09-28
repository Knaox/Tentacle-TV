import type { Room } from "../roomTypes";
import type { AffinitySession } from "./affinityTypes";

/**
 * Affinité — les séances de chaque salle, en mémoire (comme le chat) : des
 * `WeakMap` sur la salle elle-même, qui partent avec elle. Et le compteur
 * d'états diffusés, monotone par salle, séances comprises — un client ignore
 * tout état plus vieux que celui qu'il tient.
 *
 * Deux places par salle : la séance OUVERTE (celle qu'on swipe) et la
 * dernière séance REFERMÉE (quittée, partie en lecture, ou remplacée par un
 * autre type), gardée avec ses votes — relancer le même type la rouvre.
 */

const open = new WeakMap<Room, AffinitySession>();
const closed = new WeakMap<Room, AffinitySession>();
const seqs = new WeakMap<Room, number>();
let lastSessionId = 0;

export function getAffinity(room: Room): AffinitySession | null {
  return open.get(room) ?? null;
}

export function setAffinity(room: Room, session: AffinitySession | null): void {
  if (session) open.set(room, session);
  else open.delete(room);
}

/** La dernière séance refermée de la salle, gardée pour une reprise. */
export function getClosedAffinity(room: Room): AffinitySession | null {
  return closed.get(room) ?? null;
}

export function setClosedAffinity(room: Room, session: AffinitySession | null): void {
  if (session) closed.set(room, session);
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
