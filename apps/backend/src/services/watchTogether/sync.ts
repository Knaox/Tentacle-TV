import {
  clampTicks,
  WT_PROTOCOL_VERSION,
  type WtClientMessage,
  type WtStateCause,
} from "./protocol";
import type { Room, RoomMember } from "./roomTypes";
import { anchorOnPlayingSender, computeLead, scheduleResume, touch } from "./syncSchedule";
import {
  barrierParticipants, cancelResumeOnRelease, confirmReady, dropBarrier, joinBarrier, openBarrier, pruneWaiting,
  requestResumeOnRelease,
} from "./syncBarrier";
import { loadedDuringSeekBarrier } from "./syncGuards";
import { cancelPendingSkip, forgetSkipsFrom, holdPendingSkip, resetSkips } from "./syncSkip";
import { armReadyGate, isStartingMember } from "./syncReadyGate";
import { isStaleWtSeekToken } from "./watchTogetherSeekToken";
import { arrivingFreezeTicks, finishArrival, holdArrivalLeave, noteArrivalOnPresence } from "./arrival";
import { arrivalHeldElsewhere, dropArrival, isArrivingDevice } from "./arrivalState";

export { bumpEpoch } from "./syncSchedule";
// Ce qui retire un lecteur de la salle (balayage, socket fermé, départ) : `syncLeave.ts`.
export { expireStaleWaits, releaseMemberWait, removeMemberAndSync, type MemberRemoval } from "./syncLeave";

/**
 * Watch Together — mutations de l'état de lecture d'une room.
 * Le serveur est la source de vérité : chaque mutation acceptée incrémente
 * `epoch` et doit être rebroadcast (voir broadcast.ts). Les commandes no-op,
 * stales ou dédupliquées renvoient `ignore` (aucun broadcast, pas d'erreur).
 */

export type SyncOutcome =
  | { kind: "broadcast"; cause: WtStateCause }
  | { kind: "ignore" };

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
  if (resume) room.seekToken = null;
  openBarrier(room, now, "buffering", resume ? frozenTicks : room.positionTicks, [member.userId], resume, false);
  return resume ? "buffering" : "presence";
}

/** Applique une commande de lecture d'un membre. Validation de forme déjà faite
 *  (protocol.parseWtClientMessage) ; ici on applique les règles métier.
 *  `deviceKey` : l'appareil qui parle (hash du jeton de son socket) — l'arrivée
 *  d'un appareil est suivie par appareil (`arrival.ts`). */
export function applyCommand(
  room: Room,
  member: RoomMember,
  msg: Exclude<
    WtClientMessage,
    | { type: "wt:syncRequest" } | { type: "wt:autonextDismiss" } | { type: "wt:skipIntroDismiss" }
    | { type: "wt:goodbye" } | { type: "wt:chat" } | { type: "wt:reaction" } | { type: "wt:gif" } | { type: "wt:typing" }
    | { type: "wt:tick" } | { type: "wt:skipPropose" }
  >,
  isUserOnline: (userId: string) => boolean,
  deviceKey?: string,
): SyncOutcome {
  const now = Date.now();

  switch (msg.type) {
    case "wt:play": {
      if (!room.paused) return { kind: "ignore" };
      room.seekToken = null;
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
      room.seekToken = null;
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
      // Un seek plus ancien du même appareil que celui de la salle (réseau
      // réordonné) : ignoré — le plus récent a déjà posé la position.
      if (msg.seekToken && isStaleWtSeekToken(msg.seekToken, room.seekToken)) return { kind: "ignore" };
      room.seekToken = msg.seekToken ?? null;
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
      const firstLaunch = room.itemId === null;
      room.itemId = msg.itemId;
      room.contextItemId = msg.itemId;
      room.seekToken = null;
      // Démarrage gelé : attente des membres qui REGARDAIENT (auto-follow →
      // rechargement), toutes versions — un chargement se signale même d'un
      // client d'avant. Un membre qui a quitté la lecture ne suit pas le
      // changement — l'attendre gèlerait le groupe. Le lanceur (pas encore
      // inPlayback au moment du setItem) s'ajoute par son wt:buffering envoyé
      // juste après, sur le même socket (FIFO).
      // Un arrivant en route suit le nouveau titre : il est attendu aussi.
      const waitFor: string[] = [];
      for (const m of room.members.values()) {
        if ((m.inPlayback || room.arrivals.has(m.userId)) && isUserOnline(m.userId)) waitFor.push(m.userId);
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
      // « Tous prêts » : au premier lancement, tous ceux en ligne suivent ;
      // ensuite, ceux qui regardaient — et le lanceur, toujours.
      const expected = firstLaunch
        ? [...room.members.keys()].filter((userId) => isUserOnline(userId))
        : [...waitFor, member.userId];
      armReadyGate(room, msg.itemId, expected, now);
      touch(room, now, clampTicks(msg.startPositionTicks ?? 0));
      return { kind: "broadcast", cause: "setItem" };
    }

    case "wt:buffering": {
      // Le « prêt » de l'appareil qui regardait déjà, pendant qu'un autre du
      // même compte arrive : il ne lève pas l'attente de l'arrivant.
      if (!msg.buffering && arrivalHeldElsewhere(room, member.userId, deviceKey)) {
        touch(room, now);
        return { kind: "broadcast", cause: "presence" };
      }
      member.buffering = msg.buffering;
      if (msg.rttMs !== undefined) member.rttMs = msg.rttMs;
      if (msg.buffering) {
        if (!room.itemId || !member.inPlayback) {
          touch(room, now);
          return { kind: "broadcast", cause: "presence" };
        }
        // L'arrivant fait attendre la salle : un décompte de saut en cours repart en entier une fois tous prêts.
        if (isArrivingDevice(room, member.userId, deviceKey)) holdPendingSkip(room);
        const frozen = arrivingFreezeTicks(room, member.userId, deviceKey, msg.positionTicks, now);
        return { kind: "broadcast", cause: waitForMember(room, member, now, clampTicks(frozen)) };
      }
      // Un lecteur v2 qui a FINI DE CHARGER pendant une barrière de seek ou de
      // saut n'est pas posé sur sa cible pour autant : son « prêt » sans
      // identifiant ne la libère pas (sinon la salle repartait à la cible et
      // lui restait là où son chargement l'avait mis — vu au banc : salle à
      // 40 s, lui à 0 s). L'état diffusé le fait se caler, puis confirmer
      // avec l'identifiant de la barrière.
      if (loadedDuringSeekBarrier(room, member, msg.barrierId)) {
        finishArrival(room, member.userId, deviceKey);
        touch(room, now);
        return { kind: "broadcast", cause: "presence" };
      }
      const { released, resumed, stale } = confirmReady(room, member, now, msg.barrierId);
      if (stale) return { kind: "ignore" };
      // Le premier « prêt » de l'appareil qui arrive : il est là.
      finishArrival(room, member.userId, deviceKey);
      if (!released) touch(room, now);
      return { kind: "broadcast", cause: resumed ? "schedule" : "presence" };
    }

    case "wt:presence": {
      // Ce que ce lecteur sait faire, et son aller-retour : notés, jamais
      // écrasés par une absence (un message d'avant n'annonce rien).
      if (msg.protocolVersion !== undefined) member.protocolVersion = msg.protocolVersion;
      if (msg.rttMs !== undefined) member.rttMs = msg.rttMs;
      const onCurrentItem = msg.itemId === undefined || msg.itemId === room.itemId;
      const wasWatching = member.inPlayback;
      member.inPlayback = msg.inPlayback && onCurrentItem;
      if (member.inPlayback) {
        member.playbackError = false;
        // Un lecteur qui s'ouvre sur le titre : l'arrivée d'un clic se déclare,
        // un membre qui ne regardait pas commence la sienne (`arrival.ts`).
        if (room.itemId) {
          noteArrivalOnPresence(room, member, deviceKey, wasWatching, isStartingMember(room, member.userId, now), now);
        }
        touch(room, now);
        return { kind: "broadcast", cause: "presence" };
      }
      // L'appareil qui regardait déjà quitte son lecteur pendant qu'un autre du
      // compte arrive : l'attente de l'arrivant reste.
      if (arrivalHeldElsewhere(room, member.userId, deviceKey)) {
        touch(room, now);
        return { kind: "broadcast", cause: "presence" };
      }
      // L'arrivant ferme son lecteur avant d'être prêt : retour arrière, ou
      // remontage qui se redéclare aussitôt — la salle l'attend encore un instant.
      if (isArrivingDevice(room, member.userId, deviceKey) && holdArrivalLeave(room, member.userId)) {
        member.buffering = false;
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
      // L'échec de l'appareil qui regardait déjà ne dit rien de celui qui arrive.
      if (arrivalHeldElsewhere(room, member.userId, deviceKey)) return { kind: "ignore" };
      dropArrival(room, member.userId);
      member.playbackError = true;
      member.buffering = false;
      member.inPlayback = false;
      const resumed = pruneWaiting(room, member.userId, now);
      if (!resumed) touch(room, now);
      return { kind: "broadcast", cause: resumed ? "schedule" : "presence" };
    }
  }
}
