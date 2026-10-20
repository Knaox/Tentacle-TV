import type { WebSocket } from "@fastify/websocket";
import type { JellyfinUser } from "../../middleware/auth";
import { deviceKeyOfSocket } from "../wsManager";
import { onMemberRemoved } from "./roomStore";
import { handleAffinityMemberRemoved } from "./affinity/affinityService";
import { allRooms, getRoomOf } from "./roomRegistry";
import type { Room } from "./roomTypes";
import { applyCommand, bumpEpoch, expireStaleWaits, releaseMemberWait } from "./sync";
import { onBarrierExpired } from "./syncBarrier";
import { cancelPendingSkip, onSkipExecuted, proposeSkip } from "./syncSkip";
import { recordTick } from "./syncBeacon";
import { broadcastRoom, sendRoomState } from "./broadcast";
import { handleChat, handleGif, handleReaction, sendChatHistory } from "./chat";
import type { WtErrorCode, WtServerMessage } from "./protocol";
import { parseWtClientMessage } from "./protocolParse";
import { inRoomOrder, membersBlindTo } from "./itemRights";
import { registerAccessWatch } from "./accessWatch";
import { isDeviceBound, roomOnline, sendToRoom } from "./memberDevices";
import { deferSkip, onReadyGateOpened, takeDeferredSkip, wtAllReady } from "./syncReadyGate";
import { armGoodbye, registerPresence } from "./gatewayPresence";
import { wtSrvLog } from "./wtServerLog";

/**
 * Watch Together — pont WebSocket : dispatch des messages métier `wt:*`
 * (routés par routes/ws.ts après authentification) et gestion de la présence
 * (grâce de déconnexion, délivrance différée des invitations).
 */

/** Résumé de l'état de lecture d'une room pour les logs. */
function roomSnapshot(room: Room): Record<string, unknown> {
  return {
    epoch: room.epoch,
    paused: room.paused,
    reason: room.pauseReason,
    posS: (room.positionTicks / 10_000_000).toFixed(1),
    waiting: [...room.waitingFor],
  };
}

/** Réponse d'erreur au SEUL socket émetteur (pas aux autres onglets du user). */
function sendError(socket: WebSocket, code: WtErrorCode, message?: string): void {
  if (socket.readyState !== 1 /* OPEN */) return;
  const msg: WtServerMessage = { type: "wt:error", code, ...(message ? { message } : {}) };
  socket.send(JSON.stringify(msg));
}

/** Relais d'un événement transient (hors state/epoch) à toute la salle, SAUF
 *  la socket émettrice. Par socket et non par compte : un second appareil du
 *  même utilisateur est un autre lecteur, avec son propre décompte — il doit
 *  recevoir le refus comme n'importe quel invité, sinon il saute seul et, la
 *  position étant commune, embarque toute la salle (vu en production). */
function relayTransient(room: Room, from: WebSocket, msg: WtServerMessage): void {
  sendToRoom(room, msg, { exceptSocket: from });
}

/** Traite un message `wt:*` d'un client authentifié. */
export function handleWtMessage(
  user: JellyfinUser,
  raw: { type: string } & Record<string, unknown>,
  socket: WebSocket,
): void {
  const msg = parseWtClientMessage(raw);
  if (!msg) {
    wtSrvLog(`message invalide de ${user.username}`, { raw: raw.type });
    sendError(socket, "invalid");
    return;
  }

  const room = getRoomOf(user.userId);
  // Adhésion PAR APPAREIL (1.32.0) : un appareil du compte qui n'est pas lié à
  // la salle n'y parle pas — pour lui, il n'y a pas de groupe.
  const self = room?.members.get(user.userId);
  if (!room || !self || !isDeviceBound(self, deviceKeyOfSocket(socket))) {
    wtSrvLog(`${user.username} → ${msg.type} REJETÉ (${room ? "appareil non lié" : "pas dans un groupe"})`);
    sendError(socket, "not_in_group");
    return;
  }

  if (msg.type === "wt:syncRequest") {
    wtSrvLog(`${user.username} → syncRequest`, roomSnapshot(room));
    sendRoomState(user.userId, room, "sync");
    sendChatHistory(user.userId, room);
    return;
  }

  if (msg.type === "wt:chat") {
    handleChat(room, user, msg.text);
    return;
  }

  if (msg.type === "wt:reaction") {
    handleReaction(room, user, msg.emoji);
    return;
  }

  if (msg.type === "wt:gif") {
    handleGif(room, user, msg);
    return;
  }

  if (msg.type === "wt:goodbye") {
    // L'app se ferme (pagehide) : leave rapide. Grâce courte plutôt que départ
    // immédiat — un refresh émet aussi pagehide mais se reconnecte en 2-4 s
    // (la reconnexion annule la grâce).
    wtSrvLog(`${user.username} → goodbye (pagehide) — grâce courte 10s`);
    armGoodbye(user.userId, deviceKeyOfSocket(socket));
    return;
  }

  if (msg.type === "wt:skipIntroDismiss") {
    // Même nature que l'auto-next : transient, hors state/epoch. Refuser le
    // saut d'un passage vaut pour la séance — la position est commune. Le type
    // voyage tel quel, absence comprise : c'est le client qui sait quoi en faire.
    relayTransient(room, socket, {
      type: "wt:skipIntroDismiss",
      originUserId: user.userId,
      segmentType: msg.segmentType,
    });
    // Et le décompte armé par le serveur s'éteint pour tout le monde.
    if (cancelPendingSkip(room, true)) {
      wtSrvLog(`${user.username} → refus : décompte de saut annulé`, roomSnapshot(room));
      bumpEpoch(room);
      broadcastRoom(room, "presence", user.userId);
    }
    return;
  }

  if (msg.type === "wt:skipPropose") {
    const proposer = room.members.get(user.userId)!;
    // « Tous prêts » (1.32.0) : avant, aucun saut — la proposition attend la porte.
    if (!wtAllReady(room)) {
      const { segmentType, isEpisode, segmentStartTicks, toTicks } = msg;
      deferSkip(room, { userId: user.userId, proposal: { segmentType, isEpisode, segmentStartTicks, toTicks } });
      wtSrvLog(`${user.username} → skipPropose ${msg.segmentType} mis de côté (salle pas prête)`);
      return;
    }
    const armed = proposeSkip(room, proposer, msg, Date.now());
    wtSrvLog(`${user.username} → skipPropose ${msg.segmentType} ⇒ ${armed ? "armé" : "ignoré"}`, roomSnapshot(room));
    if (armed) broadcastRoom(room, "presence", user.userId);
    return;
  }

  if (msg.type === "wt:tick") {
    // Balise : l'écart de ce lecteur à la salle, son aller-retour — jamais une
    // commande. Diffusé au plus une fois par 5 s et par salle.
    const beaconMember = room.members.get(user.userId)!;
    const due = recordTick(room, beaconMember, msg, Date.now());
    wtSrvLog(`${user.username} → tick`, { driftMs: beaconMember.driftMs, rttMs: beaconMember.rttMs, due });
    if (due) {
      bumpEpoch(room);
      broadcastRoom(room, "presence", null);
    }
    return;
  }

  if (msg.type === "wt:autonextDismiss") {
    // Transient aussi : la bannière « épisode suivant » se masque partout.
    relayTransient(room, socket, { type: "wt:autonextDismiss", originUserId: user.userId });
    return;
  }

  // Un nouveau titre n'entre que si TOUS les membres le voient (cf. itemRights) ;
  // ce qui suit attend la vérification, dans l'ordre.
  if (msg.type === "wt:setItem") {
    inRoomOrder(room, async () => {
      if ((await membersBlindTo(room, msg.itemId)).length > 0) {
        wtSrvLog(`${user.username} → setItem REFUSÉ (titre caché à un membre)`);
        sendError(socket, "stale_item", "item_forbidden");
        return;
      }
      applyAndBroadcast(room, user, msg, socket);
    }, true);
    return;
  }
  inRoomOrder(room, () => applyAndBroadcast(room, user, msg, socket));
}

/** Applique une commande d'état et la diffuse — le membre a pu partir entre-temps. */
function applyAndBroadcast(room: Room, user: JellyfinUser, msg: Parameters<typeof applyCommand>[2], socket: WebSocket): void {
  const member = room.members.get(user.userId);
  if (!member) return;
  const outcome = applyCommand(room, member, msg, roomOnline(room));
  // La salle vient peut-être de devenir « tous prêts » : la proposition de saut
  // mise de côté part maintenant, dans le même état diffusé.
  const skipArmed = flushDeferredSkip(room);
  // Le socket du lecteur en séance : sa fermeture lèvera l'attente (un second
  // onglet du même compte peut rester ouvert avec un lecteur mort derrière).
  if (msg.type === "wt:presence") member.playbackSocket = member.inPlayback ? socket : null;
  wtSrvLog(
    `${user.username} → ${JSON.stringify(msg)} ⇒ ${outcome.kind === "broadcast" ? `broadcast(${outcome.cause})` : "ignore"}`,
    roomSnapshot(room),
  );
  if (outcome.kind === "broadcast") {
    broadcastRoom(room, outcome.cause, user.userId);
  } else if (skipArmed) {
    broadcastRoom(room, "presence", null);
  }
}

/** Rejoue la proposition de saut mise de côté si la salle est prête. Vrai si armée. */
function flushDeferredSkip(room: Room): boolean {
  const deferred = takeDeferredSkip(room);
  const proposer = deferred ? room.members.get(deferred.userId) : undefined;
  if (!deferred || !proposer) return false;
  const armed = proposeSkip(room, proposer, deferred.proposal, Date.now());
  wtSrvLog(`salle prête : saut ${deferred.proposal.segmentType} mis de côté ⇒ ${armed ? "armé" : "ignoré"}`);
  return armed;
}

/** Le socket d'un membre vient de se fermer (routes/ws.ts). Si c'était celui
 *  de son lecteur en séance, la salle ne l'attend plus. */
export function handleSocketClosed(userId: string, socket: WebSocket): void {
  const room = getRoomOf(userId);
  const member = room?.members.get(userId);
  if (!room || !member || member.playbackSocket !== socket) return;
  const resumed = releaseMemberWait(room, member);
  wtSrvLog(`socket de lecture fermé : ${userId} n'est plus attendu`, { resumed, ...roomSnapshot(room) });
  broadcastRoom(room, resumed ? "schedule" : "presence", null);
}

let registered = false;

/** Branche la gestion de présence (appelé une fois au démarrage du serveur). */
export function registerWatchTogetherGateway(): void {
  if (registered) return;
  registered = true;

  // Un membre qui s'en va emporte ses votes d'affinité ; sous deux membres,
  // la séance s'arrête.
  onMemberRemoved(handleAffinityMemberRemoved);
  // Un compte qui perd Watch Together sort de son salon (cf. accessWatch).
  registerAccessWatch();

  // Barrière expirée : les retardataires sont lâchés, la salle repart.
  onBarrierExpired((room) => {
    wtSrvLog("barrière expirée : retardataires lâchés, la salle repart", roomSnapshot(room));
    flushDeferredSkip(room);
    broadcastRoom(room, room.paused ? "presence" : "schedule", null);
  });

  // Décompte de saut arrivé à terme : la salle saute, par barrière.
  onSkipExecuted((room) => {
    wtSrvLog("saut de passage exécuté par le serveur", roomSnapshot(room));
    broadcastRoom(room, "skip", null);
  });

  // Anti-gel infini : un membre attendu par le group-wait depuis trop
  // longtemps (player coincé, réseau mort sans déconnexion WS) est déclaré
  // en échec de lecture et le groupe reprend sans lui.
  setInterval(() => {
    const now = Date.now();
    for (const room of allRooms()) {
      if (!room.paused || room.pauseReason !== "buffering" || room.waitingFor.size === 0) continue;
      const { expired, resumed } = expireStaleWaits(room, now);
      if (expired.length > 0) {
        wtSrvLog("SWEEP anti-gel : membres attendus > 60s marqués playbackError, le groupe reprend sans eux", {
          expired, resumed, ...roomSnapshot(room),
        });
        flushDeferredSkip(room);
        broadcastRoom(room, resumed ? "schedule" : "presence", null);
      }
    }
  }, 15_000);

  // « Tous prêts » atteint par le délai : la salle le dit, et le saut mis de côté part.
  onReadyGateOpened((room) => {
    flushDeferredSkip(room);
    bumpEpoch(room);
    broadcastRoom(room, "presence", null);
  });

  // Présence : grâce de déconnexion (par appareil lié), invitations différées.
  registerPresence();
}
