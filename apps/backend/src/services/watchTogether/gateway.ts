import type { WebSocket } from "@fastify/websocket";
import type { JellyfinUser } from "../../middleware/auth";
import { isUserOnline, onPresenceChange, sendToUser } from "../wsManager";
import { armGrace, cancelGrace, getRoomOf, invitesFor } from "./roomStore";
import { applyCommand, bumpEpoch, removeMemberAndSync } from "./sync";
import { broadcastRoom, inviteToDto, sendRoomState } from "./broadcast";
import { parseWtClientMessage, type WtErrorCode, type WtServerMessage } from "./protocol";

/**
 * Watch Together — pont WebSocket : dispatch des messages métier `wt:*`
 * (routés par routes/ws.ts après authentification) et gestion de la présence
 * (grâce de déconnexion, délivrance différée des invitations).
 */

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
    sendError(socket, "invalid");
    return;
  }

  const room = getRoomOf(user.userId);
  if (!room) {
    sendError(socket, "not_in_group");
    return;
  }

  if (msg.type === "wt:syncRequest") {
    sendRoomState(user.userId, room, "sync");
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
  if (outcome.kind === "broadcast") {
    broadcastRoom(room, outcome.cause, user.userId);
  }
}

/** Leave implicite quand la grâce de déconnexion expire. */
function onGraceExpired(userId: string): void {
  const result = removeMemberAndSync(userId);
  if (!result) return;
  if (!result.dissolved) {
    broadcastRoom(result.room, "leave", userId);
  }
}

let registered = false;

/** Branche la gestion de présence (appelé une fois au démarrage du serveur). */
export function registerWatchTogetherGateway(): void {
  if (registered) return;
  registered = true;

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
    if (!online) {
      armGrace(userId, onGraceExpired);
    }
    // Statut online/offline du membre visible par les autres.
    bumpEpoch(room);
    broadcastRoom(room, "presence", null);
  });
}
