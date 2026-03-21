import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { broadcastToUser } from "../services/wsManager";

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // GET /api/notifications — User's notifications
  app.get("/", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const query = request.query as Record<string, string>;
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    const notifications = await prisma.notification.findMany({
      where: { jellyfinUserId: user.userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return notifications;
  });

  // GET /api/notifications/unread-count
  app.get("/unread-count", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const count = await prisma.notification.count({
      where: { jellyfinUserId: user.userId, read: false },
    });

    return { count };
  });

  // POST /api/notifications/read-all — Mark all as read
  app.post("/read-all", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    await prisma.notification.updateMany({
      where: { jellyfinUserId: user.userId, read: false },
      data: { read: true },
    });

    return { success: true };
  });

  // POST /api/notifications/:id/read — Mark one as read
  app.post("/:id/read", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { id } = request.params as { id: string };

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.jellyfinUserId !== user.userId) {
      return reply.status(404).send({ message: "Notification introuvable" });
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return { success: true };
  });

  // DELETE /api/notifications/all — Delete all user's notifications
  app.delete("/all", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const result = await prisma.notification.deleteMany({
      where: { jellyfinUserId: user.userId },
    });

    broadcastToUser(user.userId, "notifications");
    return { deleted: result.count };
  });

  // DELETE /api/notifications/batch — Delete multiple by IDs
  const batchSchema = z.object({ ids: z.array(z.string()).min(1).max(100) });

  app.delete("/batch", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "ids: array of 1-100 strings required" });
    }

    const result = await prisma.notification.deleteMany({
      where: { id: { in: parsed.data.ids }, jellyfinUserId: user.userId },
    });

    broadcastToUser(user.userId, "notifications");
    return { deleted: result.count };
  });

  // DELETE /api/notifications/:id — Delete single notification
  app.delete("/:id", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { id } = request.params as { id: string };

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.jellyfinUserId !== user.userId) {
      return reply.status(404).send({ message: "Notification introuvable" });
    }

    await prisma.notification.delete({ where: { id } });

    broadcastToUser(user.userId, "notifications");
    return { deleted: 1 };
  });
};
