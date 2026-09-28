import type { Room } from "../roomTypes";
import type { AffinitySession } from "./affinityTypes";

/**
 * Affinité — la séance de chaque salle, en mémoire (comme le chat) : une
 * `WeakMap` sur la salle elle-même, qui part avec elle. Et le compteur
 * d'états diffusés, monotone par salle, séances comprises — un client ignore
 * tout état plus vieux que celui qu'il tient.
 */

const sessions = new WeakMap<Room, AffinitySession>();
const seqs = new WeakMap<Room, number>();
let lastSessionId = 0;

export function getAffinity(room: Room): AffinitySession | null {
  return sessions.get(room) ?? null;
}

export function setAffinity(room: Room, session: AffinitySession | null): void {
  if (session) sessions.set(room, session);
  else sessions.delete(room);
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
