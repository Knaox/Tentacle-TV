import { randomBytes } from "crypto";

/**
 * Les défis du test d'ouverture : un jeton que Tentacle sert UN COURT
 * INSTANT sous `/.well-known/tentacle-check/<id>`, pour que le service de
 * test sache que c'est bien ce serveur qui lui répond — pas une autre
 * machine derrière la même adresse.
 *
 * En mémoire seulement : 60 secondes, quelques lectures (HTTP et HTTPS d'une
 * même famille), puis plus rien. Inconnu, expiré ou épuisé, la route répond
 * 404 sans rien dire de plus.
 */
export const CHALLENGE_TTL_MS = 60_000;
export const CHALLENGE_MAX_READS = 4;
/** Jamais plus de défis vivants que ça : un test en pose deux (IPv4, IPv6). */
const MAX_LIVE = 16;

interface Challenge {
  token: string;
  expiresAt: number;
  readsLeft: number;
}

const challenges = new Map<string, Challenge>();

function prune(now: number): void {
  for (const [id, challenge] of challenges) if (challenge.expiresAt <= now) challenges.delete(id);
}

export function issueChallenge(now = Date.now()): { id: string; token: string } {
  prune(now);
  // Le plus ancien cède sa place : la mémoire reste bornée quoi qu'il arrive.
  while (challenges.size >= MAX_LIVE) challenges.delete(challenges.keys().next().value as string);
  const id = randomBytes(16).toString("hex");
  const token = randomBytes(16).toString("hex");
  challenges.set(id, { token, expiresAt: now + CHALLENGE_TTL_MS, readsLeft: CHALLENGE_MAX_READS });
  return { id, token };
}

/** Le jeton d'un défi vivant (une lecture de moins), ou `null`. */
export function readChallenge(id: string, now = Date.now()): string | null {
  const challenge = challenges.get(id);
  if (!challenge) return null;
  if (challenge.expiresAt <= now) {
    challenges.delete(id);
    return null;
  }
  challenge.readsLeft -= 1;
  if (challenge.readsLeft <= 0) challenges.delete(id);
  return challenge.token;
}

export function revokeChallenge(id: string): void {
  challenges.delete(id);
}

/** Tests seulement. */
export function liveChallengeCount(): number {
  return challenges.size;
}
