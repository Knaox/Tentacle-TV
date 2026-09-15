import {
  clampTicks,
  wtPositionTicksAt,
  WT_GROUP_WAIT_TIMEOUT_MS,
  WT_MIN_SEEK_INTERVAL_MS,
  WT_PROTOCOL_VERSION,
  type WtClientMessage,
  type WtStateCause,
} from "./protocol";
import { removeMember } from "./roomStore";
import type { RemovalResult, Room, RoomMember } from "./roomTypes";
import { anchorOnPlayingSender, computeLead, scheduleResume, touch } from "./syncSchedule";

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

/** Ajoute un membre au group-wait (avec horodatage pour le timeout anti-gel). */
function addWaiting(room: Room, userId: string, now: number): void {
  room.waitingFor.add(userId);
  room.waitingSince.set(userId, now);
}

/** Retire un membre du group-wait ; programme la reprise si plus personne
 *  n'est attendu — planifiée, pour que tous repartent au même instant. */
function pruneWaiting(room: Room, userId: string, now: number): boolean {
  room.waitingFor.delete(userId);
  room.waitingSince.delete(userId);
  if (room.waitingFor.size === 0 && room.paused && room.pauseReason === "buffering") {
    scheduleResume(room, now, room.positionTicks); // gelée pendant le group-wait
    return true;
  }
  return false;
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
      // Un play manuel force la reprise, y compris pendant un group-wait
      // (déblocage utilisateur si un membre reste coincé en buffering).
      room.waitingFor.clear();
      room.waitingSince.clear();
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
      room.paused = true;
      room.pauseReason = "user";
      touch(room, now, clampTicks(msg.positionTicks));
      return { kind: "broadcast", cause: "pause" };
    }

    case "wt:seek": {
      const last = room.lastSeekAt.get(member.userId) ?? 0;
      if (now - last < WT_MIN_SEEK_INTERVAL_MS) return { kind: "ignore" };
      room.lastSeekAt.set(member.userId, now);
      touch(room, now, clampTicks(msg.positionTicks));
      return { kind: "broadcast", cause: "seek" };
    }

    case "wt:setItem": {
      // Dédup (auto-next concurrents, courses) : l'émetteur doit voir l'item
      // courant ; premier arrivé gagne, les suivants sont silencieusement ignorés.
      if (msg.fromItemId !== room.itemId) return { kind: "ignore" };
      if (msg.itemId === room.itemId) return { kind: "ignore" };
      room.itemId = msg.itemId;
      room.contextItemId = msg.itemId;
      // Démarrage gelé : group-wait jusqu'à ce que les membres qui REGARDAIENT
      // (auto-follow → rechargement) soient prêts. Un membre qui a quitté la
      // lecture ne suit pas le changement — l'attendre gèlerait le groupe.
      // Le lanceur (pas encore inPlayback au moment du setItem) s'ajoute par
      // son wt:buffering envoyé juste après, sur le même socket (FIFO).
      room.paused = true;
      room.pauseReason = "buffering";
      room.waitingFor.clear();
      room.waitingSince.clear();
      for (const m of room.members.values()) {
        if (m.inPlayback && isUserOnline(m.userId)) addWaiting(room, m.userId, now);
        m.inPlayback = false;
        m.buffering = false;
        m.playbackError = false;
      }
      // Position initiale = reprise Jellyfin du lanceur (« Reprendre la
      // lecture » reprend là où IL en était), 0 sinon.
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
        addWaiting(room, member.userId, now);
        if (!room.paused) {
          // Group-wait : on gèle à la position du membre qui bufferise (les
          // autres se recaleront dessus), sinon à la position extrapolée.
          const frozen = msg.positionTicks ?? wtPositionTicksAt(room, now);
          room.paused = true;
          room.pauseReason = "buffering";
          touch(room, now, clampTicks(frozen));
          return { kind: "broadcast", cause: "buffering" };
        }
        touch(room, now);
        return { kind: "broadcast", cause: "presence" };
      }
      const resumed = pruneWaiting(room, member.userId, now);
      if (!resumed) touch(room, now);
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
  if (!result.dissolved) {
    resumed = pruneWaiting(result.room, userId, now);
    if (!resumed) touch(result.room, now);
  }
  return { ...result, resumed };
}
