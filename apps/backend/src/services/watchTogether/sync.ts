import {
  clampTicks,
  wtPositionTicksAt,
  WT_GROUP_WAIT_TIMEOUT_MS,
  WT_PROTOCOL_VERSION,
  type WtClientMessage,
  type WtStateCause,
} from "./protocol";
import { removeMember } from "./roomStore";
import type { RemovalResult, Room, RoomMember } from "./roomTypes";
import { anchorOnPlayingSender, computeLead, scheduleResume, touch } from "./syncSchedule";
import {
  barrierParticipants, cancelResumeOnRelease, confirmReady, dropBarrier, joinBarrier, openBarrier,
  requestResumeOnRelease,
} from "./syncBarrier";
import { cancelPendingSkip, forgetSkipsFrom, resetSkips } from "./syncSkip";

export { bumpEpoch } from "./syncSchedule";

/**
 * Watch Together — mutations de l'état de lecture d'une room.
 * Le serveur est la source de vérité : chaque mutation acceptée incrémente
 * `epoch` et doit être rebroadcast (voir broadcast.ts). Les commandes no-op,
 * stales ou dédupliquées renvoient `ignore` (aucun broadcast, pas d'erreur).
 */

export type SyncOutcome =
  | { kind: "broadcast"; cause: WtStateCause }
  | { kind: "ignore" };

/** Retire un membre de l'attente ; libère la barrière s'il était le dernier
 *  (reprise planifiée si la salle jouait). */
function pruneWaiting(room: Room, userId: string, now: number): boolean {
  if (!room.waitingFor.has(userId)) return false;
  return confirmReady(room, { userId }, now).resumed;
}

/** Anti-gel infini : les membres attendus depuis plus de WT_GROUP_WAIT_TIMEOUT_MS
 *  sont déclarés en échec de lecture et le groupe reprend sans eux. Appelé par
 *  le sweep périodique du gateway. */
export function expireStaleWaits(room: Room, now: number): { expired: string[]; resumed: boolean } {
  const expired: string[] = [];
  for (const [userId, since] of room.waitingSince) {
    if (now - since >= WT_GROUP_WAIT_TIMEOUT_MS) expired.push(userId);
  }
  if (expired.length === 0) return { expired, resumed: false };
  let resumed = false;
  for (const userId of expired) {
    const member = room.members.get(userId);
    if (member) {
      member.playbackError = true; // toast « X ne peut pas lire » côté clients
      member.buffering = false;
      member.inPlayback = false;
    }
    resumed = pruneWaiting(room, userId, now) || resumed;
  }
  if (!resumed) touch(room, now);
  return { expired, resumed };
}

/** Un lecteur de la salle bufferise ou recharge : la salle l'attend. */
function waitForMember(room: Room, member: RoomMember, now: number, frozenTicks: number): WtStateCause {
  if (room.barrier) {
    joinBarrier(room, member.userId, now);
    touch(room, now);
    return "presence";
  }
  // Salle en lecture : gel à la position du membre qui bufferise (les autres
  // se recaleront dessus) ; en pause utilisateur : attente sans reprise.
  const resume = !room.paused;
  openBarrier(room, now, "buffering", resume ? frozenTicks : room.positionTicks, [member.userId], resume, false);
  return resume ? "buffering" : "presence";
}

/** Applique une commande de lecture d'un membre. Validation de forme déjà faite
 *  (protocol.parseWtClientMessage) ; ici on applique les règles métier. */
export function applyCommand(
  room: Room,
  member: RoomMember,
  msg: Exclude<
    WtClientMessage,
    | { type: "wt:syncRequest" } | { type: "wt:autonextDismiss" } | { type: "wt:skipIntroDismiss" }
    | { type: "wt:goodbye" } | { type: "wt:chat" } | { type: "wt:reaction" } | { type: "wt:gif" }
    | { type: "wt:tick" } | { type: "wt:skipPropose" }
  >,
  isUserOnline: (userId: string) => boolean,
): SyncOutcome {
  const now = Date.now();

  switch (msg.type) {
    case "wt:play": {
      if (!room.paused) return { kind: "ignore" };
      if (room.barrier && !msg.force) {
        // Une attente est en cours : la reprise aura lieu quand tous seront
        // posés — jamais avant, sauf demande explicite de passer outre.
        requestResumeOnRelease(room);
        const { resumed } = confirmReady(room, member, now);
        return { kind: "broadcast", cause: resumed ? "schedule" : "play" };
      }
      dropBarrier(room);
      // Reprise PLANIFIÉE. Un lecteur v2 n'a pas lancé sa lecture : tout le
      // monde, lui compris, repart de la position qu'il a envoyée, à T. Un
      // client d'avant joue déjà : on ancre la salle là où IL sera à T.
      const lead = computeLead(room);
      const received = clampTicks(msg.positionTicks);
      const frozen = member.protocolVersion >= WT_PROTOCOL_VERSION
        ? received
        : anchorOnPlayingSender(received, member, lead);
      scheduleResume(room, now, frozen);
      return { kind: "broadcast", cause: "play" };
    }

    case "wt:pause": {
      if (room.paused && room.pauseReason === "user") return { kind: "ignore" };
      cancelResumeOnRelease(room);
      room.paused = true;
      room.pauseReason = "user";
      touch(room, now, clampTicks(msg.positionTicks));
      return { kind: "broadcast", cause: "pause" };
    }

    case "wt:seek": {
      // Une barrière sur la cible : chacun se cale en pause et confirme, le
      // dernier déclenche la reprise planifiée — si la salle jouait, ou si une
      // reprise était déjà demandée. Un nouveau seek REMPLACE l'attente en
      // cours (coalescence) : jamais d'ignorance silencieuse.
      const resume = !room.paused || (room.barrier?.resumeOnRelease ?? false);
      const target = clampTicks(msg.positionTicks);
      room.lastSeekAt.set(member.userId, now);
      // Un seek règle le décompte en cours (un clic « passer » EST un seek) ;
      // rembobiner avant le début d'un passage le redemande.
      cancelPendingSkip(room, true);
      forgetSkipsFrom(room, target);
      openBarrier(room, now, "seek", target, barrierParticipants(room), resume, true);
      return { kind: "broadcast", cause: "seek" };
    }

    case "wt:setItem": {
      // Dédup (auto-next concurrents, courses) : l'émetteur doit voir l'item
      // courant ; premier arrivé gagne, les suivants sont silencieusement ignorés.
      if (msg.fromItemId !== room.itemId) return { kind: "ignore" };
      if (msg.itemId === room.itemId) return { kind: "ignore" };
      room.itemId = msg.itemId;
      room.contextItemId = msg.itemId;
      // Démarrage gelé : attente des membres qui REGARDAIENT (auto-follow →
      // rechargement), toutes versions — un chargement se signale même d'un
      // client d'avant. Un membre qui a quitté la lecture ne suit pas le
      // changement — l'attendre gèlerait le groupe. Le lanceur (pas encore
      // inPlayback au moment du setItem) s'ajoute par son wt:buffering envoyé
      // juste après, sur le même socket (FIFO).
      const waitFor: string[] = [];
      for (const m of room.members.values()) {
        if (m.inPlayback && isUserOnline(m.userId)) waitFor.push(m.userId);
        m.inPlayback = false;
        m.buffering = false;
        m.playbackError = false;
      }
      // Position initiale = reprise Jellyfin du lanceur (« Reprendre la
      // lecture » reprend là où IL en était), 0 sinon. La salle reste en
      // attente même sans membre à attendre : le lanceur arrive juste après.
      dropBarrier(room);
      resetSkips(room);
      room.barrierId += 1;
      room.paused = true;
      room.pauseReason = "buffering";
      room.waitCause = "buffering";
      room.barrier = { id: room.barrierId, targetTicks: clampTicks(msg.startPositionTicks ?? 0), cause: "buffering", openedAt: now, resumeOnRelease: true, timer: null };
      for (const userId of waitFor) joinBarrier(room, userId, now);
      touch(room, now, clampTicks(msg.startPositionTicks ?? 0));
      return { kind: "broadcast", cause: "setItem" };
    }

    case "wt:buffering": {
      member.buffering = msg.buffering;
      if (msg.rttMs !== undefined) member.rttMs = msg.rttMs;
      if (msg.buffering) {
        if (!room.itemId || !member.inPlayback) {
          touch(room, now);
          return { kind: "broadcast", cause: "presence" };
        }
        const frozen = msg.positionTicks ?? wtPositionTicksAt(room, now);
        return { kind: "broadcast", cause: waitForMember(room, member, now, clampTicks(frozen)) };
      }
      const { released, resumed, stale } = confirmReady(room, member, now, msg.barrierId);
      if (stale) return { kind: "ignore" };
      if (!released) touch(room, now);
      return { kind: "broadcast", cause: resumed ? "schedule" : "presence" };
    }

    case "wt:presence": {
      // Ce que ce lecteur sait faire, et son aller-retour : notés, jamais
      // écrasés par une absence (un message d'avant n'annonce rien).
      if (msg.protocolVersion !== undefined) member.protocolVersion = msg.protocolVersion;
      if (msg.rttMs !== undefined) member.rttMs = msg.rttMs;
      const onCurrentItem = msg.itemId === undefined || msg.itemId === room.itemId;
      member.inPlayback = msg.inPlayback && onCurrentItem;
      if (member.inPlayback) {
        member.playbackError = false;
        touch(room, now);
        return { kind: "broadcast", cause: "presence" };
      }
      member.buffering = false;
      const resumed = pruneWaiting(room, member.userId, now);
      if (!resumed) touch(room, now);
      return { kind: "broadcast", cause: resumed ? "schedule" : "presence" };
    }

    case "wt:playbackError": {
      if (msg.itemId !== room.itemId) return { kind: "ignore" };
      member.playbackError = true;
      member.buffering = false;
      member.inPlayback = false;
      const resumed = pruneWaiting(room, member.userId, now);
      if (!resumed) touch(room, now);
      return { kind: "broadcast", cause: resumed ? "schedule" : "presence" };
    }
  }
}

/** Le socket d'un lecteur en séance s'est fermé : son attente est levée (il ne
 *  peut plus rien confirmer) ; il se redéclarera à sa reconnexion. */
export function releaseMemberWait(room: Room, member: RoomMember): boolean {
  member.inPlayback = false;
  member.buffering = false;
  member.playbackSocket = null;
  const now = Date.now();
  const resumed = pruneWaiting(room, member.userId, now);
  if (!resumed) touch(room, now);
  return resumed;
}

export interface MemberRemoval extends RemovalResult {
  /** La lecture a repris (le membre retiré était le dernier attendu du group-wait). */
  resumed: boolean;
}

/** Retire un membre (leave/kick/grâce expirée) et répare le group-wait. */
export function removeMemberAndSync(userId: string): MemberRemoval | null {
  const result = removeMember(userId);
  if (!result) return null;
  const now = Date.now();
  let resumed = false;
  if (result.dissolved) {
    resetSkips(result.room);
    dropBarrier(result.room);
  } else {
    resumed = pruneWaiting(result.room, userId, now);
    if (!resumed) touch(result.room, now);
  }
  return { ...result, resumed };
}
