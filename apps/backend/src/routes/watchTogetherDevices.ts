import type { FastifyPluginAsync } from "fastify";
import type { JellyfinUser } from "../middleware/auth";
import { getRoomOf } from "../services/watchTogether/roomRegistry";
import { bumpEpoch } from "../services/watchTogether/sync";
import { broadcastRoom, roomToDto } from "../services/watchTogether/broadcast";
import { sendChatHistory } from "../services/watchTogether/chat";
import { deviceKeyOf } from "../services/watchTogether/requestDevice";
import { bindDevice, isDeviceBound } from "../services/watchTogether/memberDevices";
import { deviceKeyOfSocket } from "../services/wsManager";
import { beginArrival } from "../services/watchTogether/arrival";
import { elsewhereFor } from "../services/watchTogether/elsewhere";
import { watchBoundDevice } from "../services/watchTogether/gatewayPresence";
import { wtAccessOf } from "../services/watchTogether/accountAccess";
import { WT_ACCESS_DENIED, wtMayJoin } from "../services/watchTogether/watchTogetherAccess";
import { WT_NOT_ELSEWHERE } from "../services/watchTogether/protocol";

/**
 * Watch Together — l'adhésion par appareil, côté REST (1.31.1, capacité
 * `watchTogether.deviceMembership`), et l'arrivée d'un appareil sur le titre
 * (`/group/arrive`, 20/10). Montées sous `/api/watch-together` par
 * `watchTogether.ts`, dont elles héritent l'authentification.
 *
 * Décision du lot du 20/10 : « Rejoindre ici » AJOUTE cet appareil à la
 * salle, il ne la retire pas aux autres — les deux PC d'un même compte y
 * restent tous deux, c'est le cas qui a fait naître la règle.
 */
export const watchTogetherDeviceRoutes: FastifyPluginAsync = async (app) => {
  /** GET /group/elsewhere — la salle du compte vue d'un appareil qui n'y est pas
   *  lié (`null` : il y est, ou le compte n'est dans aucune). */
  app.get("/group/elsewhere", async (request) => {
    const user = (request as any).user as JellyfinUser;
    if (!wtMayJoin(await wtAccessOf(user.userId))) return null;
    const deviceKey = deviceKeyOf(request);
    return deviceKey ? elsewhereFor(user.userId, deviceKey) : null;
  });

  /** POST /group/join-here — lie CET appareil à la salle de son compte. */
  app.post("/group/join-here", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const deviceKey = deviceKeyOf(request);
    const room = getRoomOf(user.userId);
    const member = room?.members.get(user.userId);
    if (!room || !member || !deviceKey || !elsewhereFor(user.userId, deviceKey)) {
      return reply.status(409).send({ code: WT_NOT_ELSEWHERE });
    }
    if (!wtMayJoin(await wtAccessOf(user.userId))) {
      return reply.status(403).send({ code: WT_ACCESS_DENIED, message: "Watch Together : non autorisé" });
    }
    bindDevice(member, deviceKey);
    watchBoundDevice(user.userId, deviceKey);
    // La salle a un titre : elle se met en pause AU CLIC et attend cet appareil.
    beginArrival(room, member, deviceKey, Date.now());
    bumpEpoch(room);
    // `join` : les autres appareils du compte apprennent qu'il y en a un de plus.
    broadcastRoom(room, "join", user.userId);
    sendChatHistory(user.userId, room);
    request.log.info({ groupId: room.groupId, user: user.username, devices: member.devices.size }, "[wt] appareil ajouté");
    return roomToDto(room);
  });

  /**
   * POST /group/arrive — « Rejoindre » d'un membre DÉJÀ dans le groupe (bande de
   * l'accueil, feuille, pilule) : comme une invitation acceptée, la salle se gèle
   * au clic et attend CET appareil (`beginArrival`) ; la réponse porte l'état
   * gelé, le lecteur s'ouvre à la position de la pause. Rien sans titre, ni pour
   * l'appareil qui regarde déjà. Capacité `watchTogether.arrival` : un client ne
   * l'appelle que si le serveur la déclare.
   */
  app.post("/group/arrive", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const deviceKey = deviceKeyOf(request);
    const room = getRoomOf(user.userId);
    const member = room?.members.get(user.userId);
    if (!room || !member || !isDeviceBound(member, deviceKey)) return reply.status(404).send({ code: "not_in_group" });
    const watchingHere = member.inPlayback && member.playbackSocket !== null
      && deviceKeyOfSocket(member.playbackSocket) === deviceKey;
    if (!watchingHere && beginArrival(room, member, deviceKey ?? null, Date.now())) {
      bumpEpoch(room);
      broadcastRoom(room, "presence", user.userId);
    }
    return roomToDto(room);
  });
};
