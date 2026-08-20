import type { WebSocket } from "@fastify/websocket";
import type { JellyfinUser } from "../../middleware/auth";
import { isUserOnline, onPresenceChange, sendToUser } from "../wsManager";
import { allRooms, armGrace, cancelGrace, getRoomOf, invitesFor, type Room } from "./roomStore";
import { applyCommand, bumpEpoch, expireStaleWaits, removeMemberAndSync } from "./sync";
import { broadcastRoom, inviteToDto, sendRoomState } from "./broadcast";
import { handleChat, handleGif, handleReaction, sendChatHistory } from "./chat";
import { parseWtClientMessage, type WtErrorCode, type WtServerMessage } from "./protocol";

/**
 * Watch Together — pont WebSocket : dispatch des messages métier `wt:*`
 * (routés par routes/ws.ts après authentification) et gestion de la présence
 * (grâce de déconnexion, délivrance différée des invitations).
 */

/** Log de diagnostic sync (grep `[WT]`) — actif automatiquement en dev
 *  (le script `pnpm dev` injecte WT_DEBUG=1), silencieux en production
 *  (l'image Docker ne définit jamais WT_DEBUG ; réactivable ponctuellement
 *  par un opérateur via cette variable d'environnement). */
const WT_DEBUG = process.env.WT_DEBUG === "1";
function wtSrvLog(message: string, data?: Record<string, unknown>): void {
  if (!WT_DEBUG) return;
  console.log(`[WT] ${message}`, data ? JSON.stringify(data) : "");
}

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
  if (!room) {
    wtSrvLog(`${user.username} → ${msg.type} REJETÉ (pas dans un groupe)`);
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
    armGrace(user.userId, onGraceExpired, 10_000);
    return;
  }

  if (msg.type === "wt:skipIntroDismiss") {
    // Même nature que l'auto-next : transient, hors state/epoch. Refuser le
    // saut d'intro vaut pour la séance — la position est commune.
    for (const memberId of room.members.keys()) {
      if (memberId !== user.userId) {
        sendToUser(memberId, { type: "wt:skipIntroDismiss", originUserId: user.userId });
      }
    }
    return;
  }

  if (msg.type === "wt:autonextDismiss") {
    // Événement transient (hors state/epoch) : relayer aux AUTRES membres —
    // la bannière « épisode suivant » se masque partout.
    for (const memberId of room.members.keys()) {
      if (memberId !== user.userId) {
        sendToUser(memberId, { type: "wt:autonextDismiss", originUserId: user.userId });
      }
    }
    return;
  }

  const member = room.members.get(user.userId)!;
  const outcome = applyCommand(room, member, msg, isUserOnline);
  wtSrvLog(
    `${user.username} → ${JSON.stringify(msg)} ⇒ ${outcome.kind === "broadcast" ? `broadcast(${outcome.cause})` : "ignore"}`,
    roomSnapshot(room),
  );
  if (outcome.kind === "broadcast") {
    broadcastRoom(room, outcome.cause, user.userId);
  }
}

/** Leave implicite quand la grâce de déconnexion expire. */
function onGraceExpired(userId: string): void {
  const result = removeMemberAndSync(userId);
  if (!result) return;
  wtSrvLog(`grâce expirée → leave implicite de ${userId}`, {
    dissolved: result.dissolved, resumed: result.resumed,
  });
  if (!result.dissolved) {
    broadcastRoom(result.room, "leave", userId);
  }
}

let registered = false;

/** Branche la gestion de présence (appelé une fois au démarrage du serveur). */
export function registerWatchTogetherGateway(): void {
  if (registered) return;
  registered = true;

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
        broadcastRoom(room, resumed ? "resume" : "presence", null);
      }
    }
  }, 15_000);

  onPresenceChange((userId, online) => {
    if (online) {
      cancelGrace(userId);
      // Délivrance différée : un invité hors ligne au moment de l'invitation
      // la reçoit dès sa prochaine connexion (si le groupe vit encore).
      for (const invite of invitesFor(userId)) {
        sendToUser(userId, { type: "wt:invite", invite: inviteToDto(invite) });
      }
    }
    const room = getRoomOf(userId);
    if (!room) return;
    wtSrvLog(`présence WS : ${userId} ${online ? "ONLINE (grâce annulée)" : "OFFLINE (grâce 120s armée)"}`, roomSnapshot(room));
    if (!online) {
      armGrace(userId, onGraceExpired);
    }
    // Statut online/offline du membre visible par les autres.
    bumpEpoch(room);
    broadcastRoom(room, "presence", null);
  });
}
