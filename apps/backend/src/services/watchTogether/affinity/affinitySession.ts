import type { WtAffinityKind, WtAffinityStateDto, WtAffinityVerdict } from "../protocol";
import type { AffinityCard, AffinityMatch, AffinityParticipant, AffinitySession } from "./affinityTypes";

/**
 * Affinité — la logique d'une séance, pure (ni socket, ni Jellyfin, ni
 * horloge : l'appelant fournit `now`).
 *
 * LA RÈGLE DU MATCH : un titre est un match quand TOUS les participants de la
 * séance l'ont aimé (« j'aime » ou « coup de cœur »), et qu'ils sont au moins
 * deux. Participant = membre de la salle qui a ouvert l'affinité ; il le reste
 * tant qu'il ne la quitte pas (ou le groupe) — fermer le panneau ne le retire
 * pas, ses votes comptent. Un membre qui n'a jamais ouvert l'affinité ne
 * bloque rien.
 *
 * Un match est acquis : l'arrivée d'un nouveau participant ne le défait pas
 * (la proposition a été faite). Seul celui qui l'avait aimé peut le défaire,
 * en annulant ou en changeant son geste.
 */

export const LIKES: ReadonlySet<WtAffinityVerdict> = new Set<WtAffinityVerdict>(["like", "superlike"]);

export function isLike(verdict: WtAffinityVerdict | undefined): boolean {
  return verdict !== undefined && LIKES.has(verdict);
}

export function createSession(input: {
  sessionId: number;
  kind: WtAffinityKind;
  startedBy: string;
  deck: AffinityCard[];
  now: number;
  /** Les matchs de la séance d'avant (changement de type) : ils restent. */
  keepMatches?: ReadonlyMap<string, AffinityMatch>;
}): AffinitySession {
  return {
    sessionId: input.sessionId,
    kind: input.kind,
    startedBy: input.startedBy,
    startedAt: input.now,
    deck: input.deck,
    index: new Map(input.deck.map((card, i) => [card.key, i])),
    participants: new Map(),
    matches: new Map(input.keepMatches ?? []),
    launch: null,
  };
}

/** Rejoint la séance ; rend vrai s'il n'y était pas. Idempotent. */
export function joinSession(
  session: AffinitySession,
  userId: string,
  allowed: ReadonlySet<string> | null,
  now: number,
): boolean {
  if (session.participants.has(userId)) return false;
  session.participants.set(userId, { userId, joinedAt: now, allowed, votes: new Map(), skipped: [] });
  return true;
}

/**
 * Quitte la séance : ses votes partent avec lui. Ce que TOUS les restants
 * aimaient devient un match — il était le seul à manquer. Rend ces clés.
 */
export function leaveSession(session: AffinitySession, userId: string, now: number): string[] {
  if (!session.participants.delete(userId)) return [];
  const candidates = new Set<string>();
  for (const participant of session.participants.values()) {
    for (const [key, verdict] of participant.votes) if (isLike(verdict)) candidates.add(key);
  }
  return [...candidates].filter((key) => evaluateMatch(session, key, now));
}

/** Pose (ou remplace) le geste d'un participant sur un titre de la pile. */
export function recordVote(
  session: AffinitySession,
  userId: string,
  key: string,
  verdict: WtAffinityVerdict,
  now: number,
): { matched: boolean; unmatched: boolean } {
  const participant = session.participants.get(userId);
  if (!participant || !session.index.has(key)) return { matched: false, unmatched: false };
  participant.votes.set(key, verdict);
  participant.skipped = participant.skipped.filter((k) => k !== key);
  if (verdict === "skip") participant.skipped.push(key);
  const unmatched = !isLike(verdict) && withdrawMatch(session, userId, key);
  if (isLike(verdict)) restampSuperlike(session.matches.get(key), userId, verdict);
  const matched = isLike(verdict) && evaluateMatch(session, key, now);
  return { matched, unmatched };
}

/** Un « j'aime » devenu coup de cœur (ou l'inverse) sur un titre déjà matché. */
function restampSuperlike(match: AffinityMatch | undefined, userId: string, verdict: WtAffinityVerdict): void {
  if (!match || !match.likedBy.includes(userId)) return;
  const others = match.superlikedBy.filter((id) => id !== userId);
  match.superlikedBy = verdict === "superlike" ? [...others, userId] : others;
}

/** Annule le geste d'un participant — un match qu'il portait tombe. */
export function undoVote(session: AffinitySession, userId: string, key: string): { unmatched: boolean } {
  const participant = session.participants.get(userId);
  if (!participant || !participant.votes.delete(key)) return { unmatched: false };
  participant.skipped = participant.skipped.filter((k) => k !== key);
  return { unmatched: withdrawMatch(session, userId, key) };
}

/** Un match que `userId` avait aimé tombe quand il se dédit. */
function withdrawMatch(session: AffinitySession, userId: string, key: string): boolean {
  const match = session.matches.get(key);
  if (!match || !match.likedBy.includes(userId)) return false;
  return session.matches.delete(key);
}

/** Le titre devient un match si tous les participants (≥ 2) l'aiment. */
function evaluateMatch(session: AffinitySession, key: string, now: number): boolean {
  if (session.matches.has(key)) return false;
  const voters = [...session.participants.values()];
  if (voters.length < 2 || !voters.every((p) => isLike(p.votes.get(key)))) return false;
  const card = cardOf(session, key);
  if (!card) return false;
  session.matches.set(key, {
    key,
    itemId: card.jellyfinItemId,
    mediaType: card.mediaType,
    title: card.title,
    year: card.year,
    at: now,
    likedBy: voters.map((p) => p.userId),
    superlikedBy: voters.filter((p) => p.votes.get(key) === "superlike").map((p) => p.userId),
  });
  return true;
}

export function cardOf(session: AffinitySession, key: string): AffinityCard | null {
  const position = session.index.get(key);
  return position === undefined ? null : session.deck[position];
}

/**
 * Les titres que d'AUTRES participants ont aimés et que `me` n'a pas encore
 * jugés — du plus aimé au moins aimé, puis dans l'ordre de la pile. Ils
 * passent devant : c'est là qu'un match attend. Rien ne le dit sur la carte.
 */
export function promotedFor(session: AffinitySession, me: AffinityParticipant): string[] {
  const counts = new Map<string, number>();
  for (const other of session.participants.values()) {
    if (other.userId === me.userId) continue;
    for (const [key, verdict] of other.votes) {
      if (isLike(verdict) && !me.votes.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const position = (key: string) => session.index.get(key) ?? Number.MAX_SAFE_INTEGER;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || position(a[0]) - position(b[0]))
    .map(([key]) => key);
}

/**
 * Les prochaines cartes de `userId` : d'abord ce que d'autres ont aimé, puis
 * la pile dans l'ordre commun, enfin ce qu'il a passé. Jamais un match (la
 * proposition est déjà faite), jamais ce qu'il ne peut pas lire, jamais ce que
 * son client tient déjà (`exclude`).
 */
export function nextCards(
  session: AffinitySession,
  userId: string,
  limit: number,
  exclude: ReadonlySet<string>,
): AffinityCard[] {
  const me = session.participants.get(userId);
  if (!me || limit <= 0) return [];
  const out: AffinityCard[] = [];
  const taken = new Set(exclude);
  const push = (key: string) => {
    if (out.length >= limit || taken.has(key) || session.matches.has(key)) return;
    if (me.allowed && !me.allowed.has(key)) return;
    const card = cardOf(session, key);
    if (!card) return;
    taken.add(key);
    out.push(card);
  };
  for (const key of promotedFor(session, me)) push(key);
  for (const card of session.deck) {
    if (out.length >= limit) break;
    if (!me.votes.has(card.key)) push(card.key);
  }
  for (const key of me.skipped) push(key);
  return out;
}

/** La projection diffusée aux membres. `seq` vient du registre de la salle. */
export function sessionToDto(session: AffinitySession, seq: number): WtAffinityStateDto {
  const launch = session.launch;
  return {
    sessionId: session.sessionId,
    seq,
    kind: session.kind,
    startedBy: session.startedBy,
    startedAt: session.startedAt,
    deckSize: session.deck.length,
    participants: [...session.participants.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ userId: p.userId, judged: p.votes.size, joinedAt: p.joinedAt })),
    matches: [...session.matches.values()]
      .sort((a, b) => b.at - a.at)
      .map((m) => ({
        key: m.key,
        itemId: m.itemId,
        mediaType: m.mediaType,
        title: m.title,
        year: m.year,
        likedBy: [...m.likedBy],
        superlikedBy: [...m.superlikedBy],
        at: m.at,
      })),
    ...(launch ? { launch: { ...launch } } : {}),
  };
}
