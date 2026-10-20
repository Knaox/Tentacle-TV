import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { createRoom } from "../services/watchTogether/roomStore";
import { getRoomOf } from "../services/watchTogether/roomRegistry";
import { removeMemberAndSync } from "../services/watchTogether/sync";
import { broadcastRoom, notifyDissolved, roomToDto } from "../services/watchTogether/broadcast";
import { refreshHostSettings } from "../services/watchTogether/hostSettings";
import { getUserBasic } from "../services/watchTogether/usersCache";
import { deviceKeyOf } from "../services/watchTogether/requestDevice";
import { isDeviceBound } from "../services/watchTogether/memberDevices";
import { notifyElsewhere } from "../services/watchTogether/elsewhere";
import { leaveFromDevice } from "../services/watchTogether/deviceLeave";
import { watchBoundDevice } from "../services/watchTogether/gatewayPresence";
import { watchTogetherDeviceRoutes } from "./watchTogetherDevices";
import { isItemVisibleTo } from "../services/itemAccess/itemVisibility";
import { wtAccessOf } from "../services/watchTogether/accountAccess";
import { WT_ACCESS_DENIED, wtMayCreate } from "../services/watchTogether/watchTogetherAccess";

/**
 * Watch Together — cycle de vie du groupe (REST).
 * La composition du groupe passe par REST ; l'état de lecture temps réel passe
 * par le WebSocket (services/watchTogether/gateway.ts). Invitations : voir
 * watchTogetherInvites.ts (même préfixe /api/watch-together).
 */
export const watchTogetherRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);
  // « Groupe en cours sur un autre appareil » et « Rejoindre ici » (1.32.0).
  await app.register(watchTogetherDeviceRoutes);

  /** POST /group — crée un groupe (créateur = hôte). 409 si déjà en groupe. */
  app.post("/group", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    // « Créer et rejoindre » seulement (SyncPlayAccess de sa politique Jellyfin).
    if (!wtMayCreate(await wtAccessOf(user.userId))) {
      return reply.status(403).send({ code: WT_ACCESS_DENIED, message: "Watch Together : création non autorisée" });
    }
    const body = z.object({ itemId: z.string().min(1).optional() })
      .parse(request.body ?? {});
    const profile = await getUserBasic(user.userId);
    // Le titre de contexte passera dans les invitations : seulement s'il est visible à l'hôte.
    const contextItemId = body.itemId && (await isItemVisibleTo(user.userId, body.itemId)) ? body.itemId : null;
    // L'appareil qui crée est le seul lié à la salle (adhésion par appareil).
    const room = createRoom(
      { userId: user.userId, username: user.username, hasAvatar: profile?.hasAvatar ?? false },
      contextItemId,
      deviceKeyOf(request),
    );
    if (!room) {
      return reply.status(409).send({ code: "already_in_group", message: "Vous êtes déjà dans un groupe" });
    }
    // Les réglages de l'hôte partent AVEC la salle : la première diffusion
    // (et la réponse REST elle-même) les porte, sinon chaque invité garderait
    // les siens jusqu'au premier changement d'hôte.
    await refreshHostSettings(room);
    watchBoundDevice(user.userId, deviceKeyOf(request));
    notifyElsewhere(user.userId);
    request.log.info({ groupId: room.groupId, host: user.username }, "[wt] groupe créé");
    return roomToDto(room);
  });

  /** GET /group — groupe courant de l'utilisateur (resync au boot). */
  /**
   * ⚠️ Ne pas repasser en 404. « L'utilisateur n'est dans aucun groupe » est
   * l'état NORMAL, et cette route est appelée à chaque montage de l'app : le
   * 404 remplissait la console du navigateur d'erreurs rouges qu'aucun code
   * ne peut faire taire (le journal vient du moteur, pas de nous). Un corps
   * `null` dit la même chose sans mentir sur la santé du serveur. Les clients
   * d'avant traduisent déjà le 404 en `null` : les deux formes se lisent.
   */
  // Un appareil du compte qui n'est pas lié à la salle n'y est pas : `null`,
  // comme hors salle (un client d'avant cesse ainsi d'y être entraîné).
  app.get("/group", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const room = getRoomOf(user.userId);
    const member = room?.members.get(user.userId);
    return room && member && isDeviceBound(member, deviceKeyOf(request)) ? roomToDto(room) : null;
  });

  /** POST /group/leave — CET appareil quitte le groupe ; le compte le quitte
   *  avec son dernier appareil lié (transfert d'hôte / GC automatiques). */
  app.post("/group/leave", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const room = getRoomOf(user.userId);
    const self = room?.members.get(user.userId);
    // Un appareil non lié ne fait rien quitter aux autres.
    if (!room || !self || !isDeviceBound(self, deviceKeyOf(request))) {
      return reply.status(404).send({ code: "not_in_group" });
    }
    if (leaveFromDevice(room, self, deviceKeyOf(request))) return { success: true };
    const result = removeMemberAndSync(user.userId);
    if (!result) return reply.status(404).send({ code: "not_in_group" });
    notifyElsewhere(user.userId);
    if (!result.dissolved) {
      // Nouvel hôte = nouveaux réglages pour le groupe, avant la diffusion.
      if (result.newHostId) await refreshHostSettings(result.room);
      broadcastRoom(result.room, "leave", user.userId);
    }
    request.log.info(
      { groupId: result.room.groupId, user: user.username, dissolved: result.dissolved },
      "[wt] membre parti",
    );
    return { success: true };
  });

  /** POST /group/kick — expulse un membre (hôte uniquement). */
  app.post("/group/kick", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const { userId: targetId } = z.object({ userId: z.string().min(1) }).parse(request.body);
    const room = getRoomOf(user.userId);
    const self = room?.members.get(user.userId);
    if (!room || !self || !isDeviceBound(self, deviceKeyOf(request))) return reply.status(404).send({ code: "not_in_group" });
    if (room.hostUserId !== user.userId) {
      return reply.status(403).send({ code: "not_host", message: "Seul l'hôte peut expulser" });
    }
    if (targetId === user.userId) {
      return reply.status(400).send({ code: "invalid", message: "Utilisez /group/leave" });
    }
    if (!room.members.has(targetId)) {
      return reply.status(404).send({ code: "not_member" });
    }
    // Expulser, c'est le compte entier : tous ses appareils liés l'apprennent.
    const result = removeMemberAndSync(targetId)!;
    notifyDissolved(result.removed, room.groupId, "kicked");
    notifyElsewhere(targetId);
    if (!result.dissolved) {
      // Nouvel hôte = nouveaux réglages pour le groupe.
      if (result.newHostId) await refreshHostSettings(result.room);
      broadcastRoom(result.room, "kick", user.userId);
    }
    request.log.info({ groupId: room.groupId, by: user.username, target: targetId }, "[wt] membre expulsé");
    return { success: true };
  });
};
