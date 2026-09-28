import type { WtAffinityKind, WtAffinityStateDto, WtAffinityVerdict } from "../protocol";
import { getRoomOf } from "../roomRegistry";
import type { RemovalResult, Room } from "../roomTypes";
import { affinityStateOf, broadcastAffinity } from "./affinityBroadcast";
import { catalogDeck, catalogKindCounts, loadGroupCatalog, readableKeys } from "./affinityCatalog";
import { getAffinity, getClosedAffinity, nextSessionId, setAffinity, setClosedAffinity } from "./affinityRegistry";
import {
  closeSession, createSession, joinSession, leaveSession, nextCards, recordVote, reopenSession, settleProposal, undoVote,
} from "./affinitySession";
import type { AffinityCard, AffinitySession } from "./affinityTypes";

/**
 * Affinité — les gestes, vus du serveur. Chaque geste accepté est diffusé à
 * toute la salle (`wt:affinity`) ; la réponse REST ne porte que ce dont
 * l'auteur a besoin tout de suite (ses cartes, l'état qu'il vient de changer).
 *
 * La séance est un mode PARTAGÉ : lancée, elle s'ouvre chez tout le groupe ;
 * un match se propose à tous, et la première réponse vaut pour tous ; quand
 * il ne reste plus deux participants — à deux, dès que l'un quitte —, elle se
 * referme chez tous. Refermée, elle garde ses votes : relancer le même type
 * la reprend. Elle n'existe que dans une salle d'au moins deux membres.
 */

export type AffinityErrorCode =
  | "not_in_group" | "need_two_members" | "empty_catalog" | "no_session"
  | "stale_session" | "not_participant" | "unknown_title" | "answered";

export type AffinityResult<T> = { ok: true; value: T } | { ok: false; status: 404 | 409; code: AffinityErrorCode };

const fail = (status: 404 | 409, code: AffinityErrorCode) => ({ ok: false, status, code }) as const;
const done = <T>(value: T) => ({ ok: true, value }) as const;

interface Scope {
  room: Room;
  session: AffinitySession;
}

/** La salle et la séance ouverte d'un compte, ou l'erreur qui dit laquelle
 *  manque ; `participant` exige en plus qu'il swipe. */
function scopeOf(userId: string, options: { sessionId?: number; participant?: boolean } = {}): AffinityResult<Scope> {
  const room = getRoomOf(userId);
  if (!room) return fail(404, "not_in_group");
  const session = getAffinity(room);
  if (!session) return fail(404, "no_session");
  if (options.sessionId !== undefined && session.sessionId !== options.sessionId) return fail(409, "stale_session");
  if (options.participant && !session.participants.has(userId)) return fail(409, "not_participant");
  return done({ room, session });
}

export function currentAffinity(userId: string): WtAffinityStateDto | null {
  const room = getRoomOf(userId);
  return room ? affinityStateOf(room) : null;
}

/** Combien de titres de chaque type tout le groupe peut lire, et le type de
 *  la séance refermée qu'un lancement reprendrait. */
export async function affinityKinds(
  userId: string,
): Promise<AffinityResult<{ counts: Record<WtAffinityKind, number>; resume: WtAffinityKind | null }>> {
  const room = getRoomOf(userId);
  if (!room) return fail(404, "not_in_group");
  if (room.members.size < 2) return fail(409, "need_two_members");
  const catalog = await loadGroupCatalog([...room.members.keys()], userId);
  return done({ counts: catalogKindCounts(catalog), resume: getClosedAffinity(room)?.kind ?? null });
}

/**
 * Lance la séance : elle s'ouvre chez tout le groupe, chacun y entrant en
 * ouvrant sa pile. Le type de la séance refermée : on la rouvre, votes
 * compris. Un autre type qu'une séance ouverte : on change de type — la pile
 * repart pour tout le monde, l'ancienne est gardée refermée. Le type de la
 * séance ouverte : rien ne change.
 */
export async function startAffinity(userId: string, kind: WtAffinityKind): Promise<AffinityResult<WtAffinityStateDto>> {
  let room = getRoomOf(userId);
  if (!room) return fail(404, "not_in_group");
  if (room.members.size < 2) return fail(409, "need_two_members");
  if (getAffinity(room)?.kind === kind) return done(affinityStateOf(room)!);

  const now = Date.now();
  let session = getClosedAffinity(room)?.kind === kind ? getClosedAffinity(room) : null;
  if (session) {
    reopenSession(session, { sessionId: nextSessionId(), startedBy: userId, now });
  } else {
    const audience = [...room.members.keys()];
    const sessionId = nextSessionId();
    const catalog = await loadGroupCatalog(audience, userId);
    // La salle a pu changer pendant la lecture des bibliothèques.
    room = getRoomOf(userId);
    if (!room) return fail(404, "not_in_group");
    if (room.members.size < 2) return fail(409, "need_two_members");
    // Lancée entre-temps par un autre : on la rejoint.
    if (getAffinity(room)?.kind === kind) return done(affinityStateOf(room)!);
    const deck = catalogDeck(catalog, kind, `${room.groupId}:${sessionId}`);
    if (deck.length === 0) return fail(409, "empty_catalog");
    session = createSession({ sessionId, kind, startedBy: userId, deck, now, audience });
  }

  const previous = getAffinity(room);
  if (previous) {
    closeSession(previous);
    setClosedAffinity(room, previous);
  } else if (getClosedAffinity(room) === session) {
    setClosedAffinity(room, null);
  }
  // Hors de l'audience de la pile (arrivé dans la salle après elle), il y
  // entre par sa pile : `join` calcule ce qu'il peut lire.
  if (session.audience.has(userId)) joinSession(session, userId, null, now);
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

/**
 * Quitter l'affinité : on ne swipe plus, les votes restent (pour une
 * reprise). Sans séance ouverte, rien à faire.
 */
export function quitAffinity(userId: string): AffinityResult<null> {
  const scope = scopeOf(userId);
  if (!scope.ok) return scope.code === "no_session" ? done(null) : scope;
  const { room, session } = scope.value;
  if (session.participants.has(userId)) depart(room, session, userId, false);
  return done(null);
}

/**
 * Un participant s'en va (`forget` : il quitte le groupe, ses votes avec
 * lui). Sous deux participants, la séance se referme chez tous — à deux,
 * l'autre la quitte aussi. Sinon les autres continuent, et ce qu'ils
 * aimaient tous devient un match.
 */
function depart(room: Room, session: AffinitySession, userId: string, forget: boolean): void {
  const matched = leaveSession(session, userId, Date.now(), forget);
  if (session.participants.size < 2) {
    closeOpenSession(room, session);
    broadcastAffinity(room, "quit", userId);
    return;
  }
  broadcastAffinity(room, "quit", userId, { matchKeys: matched });
}

/** Referme la séance ouverte ; elle prend la place de la refermée d'avant. */
function closeOpenSession(room: Room, session: AffinitySession): void {
  closeSession(session);
  setAffinity(room, null);
  setClosedAffinity(room, session);
}

export function affinityCards(
  userId: string,
  sessionId: number,
  limit: number,
  exclude: readonly string[],
): AffinityResult<AffinityCard[]> {
  const scope = scopeOf(userId, { sessionId, participant: true });
  if (!scope.ok) return scope;
  return done(nextCards(scope.value.session, userId, limit, new Set(exclude)));
}

/** Un verdict sur une carte ; rend s'il vient de faire un match, et l'état. */
export function voteAffinity(
  userId: string,
  sessionId: number,
  key: string,
  verdict: WtAffinityVerdict,
): AffinityResult<{ matched: boolean; state: WtAffinityStateDto }> {
  const scope = scopeOf(userId, { sessionId, participant: true });
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  if (!session.index.has(key)) return fail(404, "unknown_title");
  const { matched, unmatched } = recordVote(session, userId, key, verdict, Date.now());
  const cause = matched ? "match" : unmatched ? "unmatch" : "vote";
  broadcastAffinity(room, cause, userId, { matchKeys: matched ? [key] : [], match: unmatched });
  return done({ matched, state: affinityStateOf(room)! });
}

export function undoAffinityVote(userId: string, sessionId: number, key: string): AffinityResult<null> {
  const scope = scopeOf(userId, { sessionId, participant: true });
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  const { unmatched } = undoVote(session, userId, key);
  broadcastAffinity(room, unmatched ? "unmatch" : "vote", userId, { match: unmatched });
  return done(null);
}

/**
 * « Continuer à swiper » : le match en attente est écarté, chez tous — la
 * pile reprend chez tous. Idempotent : déjà tranché, l'état revient tel quel.
 */
export function dismissAffinityMatch(userId: string, key: string): AffinityResult<WtAffinityStateDto> {
  const scope = scopeOf(userId, { participant: true });
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  const match = settleProposal(session, key);
  if (match) broadcastAffinity(room, "dismiss", userId, { match });
  return done(affinityStateOf(room)!);
}

/**
 * « Regarder ensemble » : le match part en lecture et la séance se referme
 * chez tous — ceux qui swipaient suivront le lancement. Refusé (`answered`)
 * si le match n'attend plus : quelqu'un a répondu avant.
 */
export function launchAffinity(userId: string, key: string): AffinityResult<null> {
  const scope = scopeOf(userId, { participant: true });
  if (!scope.ok) return scope;
  const { room, session } = scope.value;
  const match = settleProposal(session, key);
  if (!match) return fail(409, "answered");
  closeOpenSession(room, session);
  broadcastAffinity(room, "launch", userId, { match });
  return done(null);
}

/**
 * Un membre a quitté la salle (départ, expulsion, grâce expirée) : ses votes
 * partent avec lui, séance refermée comprise. Sous deux membres, la séance
 * s'arrête.
 */
export function handleAffinityMemberRemoved({ room, removed, dissolved }: RemovalResult): void {
  if (dissolved) {
    setAffinity(room, null);
    setClosedAffinity(room, null);
    return;
  }
  getClosedAffinity(room)?.ballots.delete(removed.userId);
  const session = getAffinity(room);
  if (!session) return;
  if (room.members.size < 2) {
    leaveSession(session, removed.userId, Date.now(), true);
    closeOpenSession(room, session);
    broadcastAffinity(room, "end", removed.userId);
    return;
  }
  if (session.participants.has(removed.userId)) depart(room, session, removed.userId, true);
  else session.ballots.delete(removed.userId);
}
