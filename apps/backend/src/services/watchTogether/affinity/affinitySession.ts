import type { WtAffinityKind, WtAffinityMatchDto, WtAffinityStateDto, WtAffinityVerdict } from "../protocol";
import type { AffinityCard, AffinityMatch, AffinitySession } from "./affinityTypes";

/**
 * Affinité — la logique d'une séance, pure (ni socket, ni Jellyfin, ni
 * horloge : l'appelant fournit `now`).
 *
 * LA RÈGLE DU MATCH : un titre est un match quand TOUS les participants de la
 * séance l'ont aimé, et qu'ils sont au moins deux. Participant = membre de la
 * salle qui swipe en ce moment (sa pile est ouverte) ; un membre qui ne l'a
 * pas ouverte ne bloque rien.
 *
 * UN MATCH EST UNE PROPOSITION faite à tous : il attend, dans `proposals`,
 * que quelqu'un y réponde — « Regarder ensemble » (lancé) ou « Continuer à
 * swiper » (écarté) — et la première réponse vaut pour tous. Un titre tranché
 * ne revient plus. Tant qu'il attend, seul le dédit de quelqu'un qui l'aimait
 * (annuler, ou « pas pour moi ») le défait.
 */

export function createSession(input: {
  sessionId: number;
  kind: WtAffinityKind;
  startedBy: string;
  deck: AffinityCard[];
  now: number;
  /** Les membres dont la pile croise les bibliothèques. */
  audience?: Iterable<string>;
}): AffinitySession {
  return {
    sessionId: input.sessionId,
    kind: input.kind,
    startedBy: input.startedBy,
    startedAt: input.now,
    deck: input.deck,
    audience: new Set(input.audience ?? []),
    index: new Map(input.deck.map((card, i) => [card.key, i])),
    participants: new Map(),
    ballots: new Map(),
    proposals: [],
    settled: new Set(),
  };
}

/** Referme la séance : plus personne ne swipe. Les votes, les matchs en
 *  attente et ceux déjà tranchés restent — de quoi la rouvrir telle quelle. */
export function closeSession(session: AffinitySession): void {
  session.participants.clear();
}

/**
 * Rouvre une séance refermée : même pile, mêmes votes, mêmes matchs en
 * attente — on reprend là où l'on était. Le nouvel identifiant périme ce que
 * les clients tenaient ; chacun redevient participant en ouvrant sa pile.
 */
export function reopenSession(session: AffinitySession, input: { sessionId: number; startedBy: string; now: number }): void {
  session.sessionId = input.sessionId;
  session.startedBy = input.startedBy;
  session.startedAt = input.now;
  session.participants.clear();
}

function ballotOf(session: AffinitySession, userId: string): Map<string, WtAffinityVerdict> {
  let ballot = session.ballots.get(userId);
  if (!ballot) {
    ballot = new Map();
    session.ballots.set(userId, ballot);
  }
  return ballot;
}

/** Rejoint la séance ; rend vrai s'il n'y était pas. Idempotent. Qui l'avait
 *  quittée retrouve ses votes. */
export function joinSession(
  session: AffinitySession,
  userId: string,
  allowed: ReadonlySet<string> | null,
  now: number,
): boolean {
  if (session.participants.has(userId)) return false;
  session.participants.set(userId, { userId, joinedAt: now, allowed });
  ballotOf(session, userId);
  return true;
}

/**
 * Un participant s'en va : il quitte l'affinité (ses votes restent, pour
 * s'il revient) ou le groupe (`forget` : ils partent avec lui). Ce que TOUS
 * les restants aimaient devient un match — il était le seul à manquer.
 * Rend ces clés, dans l'ordre de la pile.
 */
export function leaveSession(session: AffinitySession, userId: string, now: number, forget = false): string[] {
  if (forget) session.ballots.delete(userId);
  if (!session.participants.delete(userId)) return [];
  const candidates = new Set<string>();
  for (const id of session.participants.keys()) {
    for (const [key, verdict] of session.ballots.get(id) ?? []) if (verdict === "like") candidates.add(key);
  }
  return [...candidates]
    .sort((a, b) => positionOf(session, a) - positionOf(session, b))
    .filter((key) => evaluateMatch(session, key, now));
}

/** Pose (ou remplace) le verdict d'un participant sur un titre de la pile.
 *  `unmatched` : le match en attente que ce « pas pour moi » défait. */
export function recordVote(
  session: AffinitySession,
  userId: string,
  key: string,
  verdict: WtAffinityVerdict,
  now: number,
): { matched: boolean; unmatched: AffinityMatch | null } {
  if (!session.participants.has(userId) || !session.index.has(key)) return { matched: false, unmatched: null };
  ballotOf(session, userId).set(key, verdict);
  if (verdict === "dislike") return { matched: false, unmatched: withdrawProposal(session, userId, key) };
  return { matched: evaluateMatch(session, key, now), unmatched: null };
}

/** Annule le verdict d'un participant — un match en attente qu'il aimait tombe. */
export function undoVote(session: AffinitySession, userId: string, key: string): { unmatched: AffinityMatch | null } {
  if (!session.participants.has(userId) || !session.ballots.get(userId)?.delete(key)) return { unmatched: null };
  return { unmatched: withdrawProposal(session, userId, key) };
}

/**
 * La réponse du groupe à un match en attente — lancé ou écarté : il quitte
 * les propositions et ne reviendra plus. Rend le match, ou null s'il
 * n'attendait plus (quelqu'un a répondu avant, ou un dédit l'a défait).
 */
export function settleProposal(session: AffinitySession, key: string): AffinityMatch | null {
  const index = session.proposals.findIndex((m) => m.key === key);
  if (index < 0) return null;
  session.settled.add(key);
  return session.proposals.splice(index, 1)[0];
}

/** Un match en attente que `userId` aimait tombe quand il se dédit. */
function withdrawProposal(session: AffinitySession, userId: string, key: string): AffinityMatch | null {
  const index = session.proposals.findIndex((m) => m.key === key);
  if (index < 0 || !session.proposals[index].likedBy.includes(userId)) return null;
  return session.proposals.splice(index, 1)[0];
}

/** Le titre devient un match, proposé à tous, si tous les participants
 *  (au moins deux) l'aiment — jamais un titre déjà proposé ou tranché. */
function evaluateMatch(session: AffinitySession, key: string, now: number): boolean {
  if (session.settled.has(key) || session.proposals.some((m) => m.key === key)) return false;
  const voters = [...session.participants.keys()];
  if (voters.length < 2 || !voters.every((id) => session.ballots.get(id)?.get(key) === "like")) return false;
  const card = cardOf(session, key);
  if (!card) return false;
  session.proposals.push({
    key,
    itemId: card.jellyfinItemId,
    mediaType: card.mediaType,
    title: card.title,
    year: card.year,
    at: now,
    likedBy: voters,
  });
  return true;
}

export function cardOf(session: AffinitySession, key: string): AffinityCard | null {
  const position = session.index.get(key);
  return position === undefined ? null : session.deck[position];
}

function positionOf(session: AffinitySession, key: string): number {
  return session.index.get(key) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Les titres que d'AUTRES participants ont aimés et que `userId` n'a pas
 * encore jugés — du plus aimé au moins aimé, puis dans l'ordre de la pile.
 * Ils passent devant : c'est là qu'un match attend. Rien ne le dit sur la carte.
 */
export function promotedFor(session: AffinitySession, userId: string): string[] {
  const mine = session.ballots.get(userId);
  const counts = new Map<string, number>();
  for (const other of session.participants.keys()) {
    if (other === userId) continue;
    for (const [key, verdict] of session.ballots.get(other) ?? []) {
      if (verdict === "like" && !mine?.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || positionOf(session, a[0]) - positionOf(session, b[0]))
    .map(([key]) => key);
}

/**
 * Les prochaines cartes de `userId` : d'abord ce que d'autres ont aimé, puis
 * la pile dans l'ordre commun. Jamais ce qu'il a déjà jugé, jamais un match
 * (en attente ou tranché), jamais ce qu'il ne peut pas lire, jamais ce que
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
  const mine = session.ballots.get(userId);
  const pending = new Set(session.proposals.map((m) => m.key));
  const out: AffinityCard[] = [];
  const taken = new Set(exclude);
  const push = (key: string) => {
    if (out.length >= limit || taken.has(key) || mine?.has(key) || session.settled.has(key) || pending.has(key)) return;
    if (me.allowed && !me.allowed.has(key)) return;
    const card = cardOf(session, key);
    if (!card) return;
    taken.add(key);
    out.push(card);
  };
  for (const key of promotedFor(session, userId)) push(key);
  for (const card of session.deck) {
    if (out.length >= limit) break;
    push(card.key);
  }
  return out;
}

export function matchToDto(match: AffinityMatch): WtAffinityMatchDto {
  return {
    key: match.key,
    itemId: match.itemId,
    mediaType: match.mediaType,
    title: match.title,
    year: match.year,
    likedBy: [...match.likedBy],
    at: match.at,
  };
}

/** La projection diffusée aux membres. `seq` vient du registre de la salle. */
export function sessionToDto(session: AffinitySession, seq: number): WtAffinityStateDto {
  return {
    sessionId: session.sessionId,
    seq,
    kind: session.kind,
    startedBy: session.startedBy,
    startedAt: session.startedAt,
    deckSize: session.deck.length,
    participants: [...session.participants.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ userId: p.userId, judged: session.ballots.get(p.userId)?.size ?? 0, joinedAt: p.joinedAt })),
    proposals: session.proposals.map(matchToDto),
  };
}
