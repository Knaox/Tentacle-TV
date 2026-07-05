import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { createRoom, getRoomOf } from "../services/watchTogether/roomStore";
import { removeMemberAndSync } from "../services/watchTogether/sync";
import { broadcastRoom, notifyDissolved, roomToDto } from "../services/watchTogether/broadcast";
import { getUserBasic } from "../services/watchTogether/usersCache";

/**
 * Watch Together — cycle de vie du groupe (REST).
 * La composition du groupe passe par REST ; l'état de lecture temps réel passe
 * par le WebSocket (services/watchTogether/gateway.ts). Invitations : voir
 * watchTogetherInvites.ts (même préfixe /api/watch-together).
 */
export const watchTogetherRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** POST /group — crée un groupe (créateur = hôte). 409 si déjà en groupe. */
  app.post("/group", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const body = z.object({ itemId: z.string().min(1).optional() })
      .parse(request.body ?? {});
    const profile = await getUserBasic(user.userId);
    const room = createRoom(
      { userId: user.userId, username: user.username, hasAvatar: profile?.hasAvatar ?? false },
      body.itemId ?? null,
    );
    if (!room) {
      return reply.status(409).send({ code: "already_in_group", message: "Vous êtes déjà dans un groupe" });
    }
    request.log.info({ groupId: room.groupId, host: user.username }, "[wt] groupe créé");
    return roomToDto(room);
  });

  /** GET /group — groupe courant de l'utilisateur (resync au boot). */
  app.get("/group", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const room = getRoomOf(user.userId);
    if (!room) return reply.status(404).send({ code: "not_in_group" });
    return roomToDto(room);
  });

  /** POST /group/leave — quitte le groupe (transfert d'hôte / GC automatiques). */
  app.post("/group/leave", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const result = removeMemberAndSync(user.userId);
    if (!result) return reply.status(404).send({ code: "not_in_group" });
    if (!result.dissolved) {
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
    if (!room) return reply.status(404).send({ code: "not_in_group" });
    if (room.hostUserId !== user.userId) {
      return reply.status(403).send({ code: "not_host", message: "Seul l'hôte peut expulser" });
    }
    if (targetId === user.userId) {
      return reply.status(400).send({ code: "invalid", message: "Utilisez /group/leave" });
    }
    if (!room.members.has(targetId)) {
      return reply.status(404).send({ code: "not_member" });
    }
    const result = removeMemberAndSync(targetId)!;
    notifyDissolved(targetId, room.groupId, "kicked");
    if (!result.dissolved) {
      broadcastRoom(result.room, "kick", user.userId);
    }
    request.log.info({ groupId: room.groupId, by: user.username, target: targetId }, "[wt] membre expulsé");
    return { success: true };
  });
};
