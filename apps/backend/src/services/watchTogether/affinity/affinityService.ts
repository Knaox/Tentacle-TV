import type { WtAffinityKind, WtAffinityStateDto, WtAffinityVerdict } from "../protocol";
import { getRoomOf } from "../roomRegistry";
import type { RemovalResult, Room } from "../roomTypes";
import { affinityStateOf, broadcastAffinity } from "./affinityBroadcast";
import { catalogDeck, catalogKindCounts, loadGroupCatalog, readableKeys } from "./affinityCatalog";
import { getAffinity, nextSessionId, setAffinity } from "./affinityRegistry";
import {
  createSession, joinSession, leaveSession, nextCards, recordVote, undoVote,
} from "./affinitySession";
import type { AffinityCard, AffinitySession } from "./affinityTypes";

/**
 * Affinité — les gestes, vus du serveur. Chaque geste accepté est diffusé à
 * toute la salle (`wt:affinity`) ; la réponse REST ne porte que ce dont
 * l'auteur a besoin tout de suite (ses cartes, s'il a fait un match).
 *
 * Une séance n'existe que dans une salle d'au moins deux membres : elle
 * s'arrête d'elle-même quand la salle passe sous ce seuil.
 */

export type AffinityErrorCode =
  | "not_in_group" | "need_two_members" | "empty_catalog" | "no_session"
  | "stale_session" | "not_participant" | "unknown_title";

export type AffinityResult<T> = { ok: true; value: T } | { ok: false; status: 404 | 409; code: AffinityErrorCode };

const fail = (status: 404 | 409, code: AffinityErrorCode) => ({ ok: false, status, code }) as const;
const done = <T>(value: T) => ({ ok: true, value }) as const;

interface Scope {
  room: Room;
  session: AffinitySession;
}

/** La salle et la séance d'un compte, ou l'erreur qui dit laquelle manque. */
function scopeOf(userId: string, sessionId?: number): AffinityResult<Scope> {
  const room = getRoomOf(userId);
  if (!room) return fail(404, "not_in_group");
  const session = getAffinity(room);
  if (!session) return fail(404, "no_session");
  if (sessionId !== undefined && session.sessionId !== sessionId) return fail(409, "stale_session");
  return done({ room, session });
}

export function currentAffinity(userId: string): WtAffinityStateDto | null {
  const room = getRoomOf(userId);
  return room ? affinityStateOf(room) : null;
}

/** Combien de titres de chaque type tout le groupe peut lire. */
export async function affinityKinds(userId: string): Promise<AffinityResult<Record<WtAffinityKind, number>>> {
  const room = getRoomOf(userId);
  if (!room) return fail(404, "not_in_group");
  if (room.members.size < 2) return fail(409, "need_two_members");
  const catalog = await loadGroupCatalog([...room.members.keys()], userId);
  return done(catalogKindCounts(catalog));
}

/**
 * Lance la séance — ou change de type : la pile repart, les votes aussi,
 * les matchs restent. Ceux qui swipaient restent participants ; l'auteur le
 * devient.
 */
export async function startAffinity(userId: string, kind: WtAffinityKind): Promise<AffinityResult<WtAffinityStateDto>> {
  const before = getRoomOf(userId);
  if (!before) return fail(404, "not_in_group");
  if (before.members.size < 2) return fail(409, "need_two_members");
  const audience = [...before.members.keys()];
  const sessionId = nextSessionId();
  const catalog = await loadGroupCatalog(audience, userId);
  // La salle a pu changer pendant la lecture des bibliothèques.
  const room = getRoomOf(userId);
  if (!room) return fail(404, "not_in_group");
  if (room.members.size < 2) return fail(409, "need_two_members");
  const deck = catalogDeck(catalog, kind, `${room.groupId}:${sessionId}`);
  if (deck.length === 0) return fail(409, "empty_catalog");

  const now = Date.now();
  const previous = getAffinity(room);
  const session = createSession({ sessionId, kind, startedBy: userId, deck, now, audience, keepMatches: previous?.matches });
  for (const participant of previous?.participants.values() ?? []) {
    if (session.audience.has(participant.userId)) joinSession(session, participant.userId, null, participant.joinedAt);
  }
  joinSession(session, userId, null, now);
  setAffinity(room, session);
  broadcastAffinity(room, previous ? "switch" : "start", userId);
  return done(affinityStateOf(room)!);
}

/** Rejoint la séance (idempotent) et rend les premières cartes. */
export async function joinAffinity(
  userId: string,
  limit: number,
): Promise<AffinityResult<{ state: WtAffinityStateDto; sessionId: number; cards: AffinityCard[] }>> {
  const scope = scopeOf(userId);
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  if (!session.participants.has(userId)) {
    // Arrivé après le lancement : la pile ne connaît pas sa bibliothèque.
    const allowed = session.audience.has(userId) ? null : await readableKeys(userId);
    if (getAffinity(room) !== session) return fail(409, "stale_session");
    if (joinSession(session, userId, allowed, Date.now())) broadcastAffinity(room, "join", userId);
  }
  return done({
    state: affinityStateOf(room)!,
    sessionId: session.sessionId,
    cards: nextCards(session, userId, limit, new Set()),
  });
}

/** Ne plus participer : ses votes partent, ce que les restants aimaient tous
 *  devient un match. */
export function leaveAffinity(userId: string): AffinityResult<null> {
  const scope = scopeOf(userId);
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  if (!session.participants.has(userId)) return done(null);
  const matched = leaveSession(session, userId, Date.now());
  broadcastAffinity(room, matched.length > 0 ? "match" : "leave", userId, matched);
  return done(null);
}

export function affinityCards(
  userId: string,
  sessionId: number,
  limit: number,
  exclude: readonly string[],
): AffinityResult<AffinityCard[]> {
  const scope = scopeOf(userId, sessionId);
  if (!scope.ok) return scope;
  const { session } = scope.value;
  if (!session.participants.has(userId)) return fail(409, "not_participant");
  return done(nextCards(session, userId, limit, new Set(exclude)));
}

/** Un geste sur une carte ; rend vrai s'il vient de faire un match. */
export function voteAffinity(
  userId: string,
  sessionId: number,
  key: string,
  verdict: WtAffinityVerdict,
): AffinityResult<{ matched: boolean }> {
  const scope = scopeOf(userId, sessionId);
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  if (!session.participants.has(userId)) return fail(409, "not_participant");
  if (!session.index.has(key)) return fail(404, "unknown_title");
  const { matched, unmatched } = recordVote(session, userId, key, verdict, Date.now());
  broadcastAffinity(room, matched ? "match" : unmatched ? "unmatch" : "vote", userId, matched ? [key] : []);
  return done({ matched });
}

export function undoAffinityVote(userId: string, sessionId: number, key: string): AffinityResult<null> {
  const scope = scopeOf(userId, sessionId);
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  if (!session.participants.has(userId)) return fail(409, "not_participant");
  const { unmatched } = undoVote(session, userId, key);
  broadcastAffinity(room, unmatched ? "unmatch" : "vote", userId);
  return done(null);
}

/** Un match est lancé : ceux qui swipaient suivront la lecture. */
export function launchAffinity(userId: string, key: string): AffinityResult<null> {
  const scope = scopeOf(userId);
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  const match = session.matches.get(key);
  if (!match) return fail(404, "unknown_title");
  session.launch = { key, itemId: match.itemId, byUserId: userId, at: Date.now() };
  broadcastAffinity(room, "launch", userId);
  return done(null);
}

/**
 * Un membre a quitté la salle (départ, expulsion, grâce expirée) : ses votes
 * partent avec lui. Sous deux membres, la séance s'arrête.
 */
export function handleAffinityMemberRemoved({ room, removed, dissolved }: RemovalResult): void {
  const session = getAffinity(room);
  if (!session) return;
  if (dissolved || room.members.size < 2) {
    setAffinity(room, null);
    if (!dissolved) broadcastAffinity(room, "end", removed.userId);
    return;
  }
  if (!session.participants.has(removed.userId)) return;
  const matched = leaveSession(session, removed.userId, Date.now());
  broadcastAffinity(room, matched.length > 0 ? "match" : "leave", removed.userId, matched);
}
