import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { toNotificationDto } from "../notifications/notificationDto";
import { notificationsFiltered, visibleNotificationRows } from "../notifications/notificationRights";
import { notifyNotificationsChanged } from "./notifications.notify";

/** Le curseur de la page suivante de la cloche (voir `notifications.paging`). */
export const NOTIFICATIONS_NEXT_HEADER = "X-Notifications-Next";

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // GET /api/notifications — User's notifications, page par page (capacité `notifications.paging`)
  app.get("/", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const query = request.query as Record<string, string>;
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    // Le curseur : la dernière notification de la page d'avant (jamais celle d'un autre compte,
    // le filtre par compte reste). Disparue entre-temps : page vide, la relecture suivante recolle.
    const before = typeof query.before === "string" && query.before.length > 0 ? query.before : null;

    const notifications = await prisma.notification.findMany({
      where: { jellyfinUserId: user.userId },
      // L'identifiant départage les lignes écrites dans la même milliseconde : pages stables.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });
    // Une page pleine en annonce peut-être une autre — avant le filtre des droits, qui la raccourcit.
    if (notifications.length === limit) reply.header(NOTIFICATIONS_NEXT_HEADER, notifications[notifications.length - 1].id);

    // Un avis dont le titre est caché au compte AUJOURD'HUI ne se lit plus (cf. notificationRights).
    return (await visibleNotificationRows(user.userId, notifications)).map(toNotificationDto);
  });

  // GET /api/notifications/unread-count
  app.get("/unread-count", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const where = { jellyfinUserId: user.userId, read: false };
    if (!(await notificationsFiltered(user.userId))) return { count: await prisma.notification.count({ where }) };
    // Compte restreint : les avis qu'il ne peut plus lire ne comptent pas.
    const unread = await prisma.notification.findMany({ where, select: { target: true }, take: 500 });
    return { count: (await visibleNotificationRows(user.userId, unread)).length };
  });

  // POST /api/notifications/read-all — Mark all as read
  app.post("/read-all", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const { count } = await prisma.notification.updateMany({
      where: { jellyfinUserId: user.userId, read: false },
      data: { read: true },
    });

    if (count > 0) notifyNotificationsChanged(request, user.userId);
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

    if (!notif.read) {
      await prisma.notification.update({
        where: { id },
        data: { read: true },
      });
      notifyNotificationsChanged(request, user.userId);
    }

    return { success: true };
  });

  // DELETE /api/notifications/all — Delete all user's notifications
  app.delete("/all", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const result = await prisma.notification.deleteMany({
      where: { jellyfinUserId: user.userId },
    });

    if (result.count > 0) notifyNotificationsChanged(request, user.userId);
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

    if (result.count > 0) notifyNotificationsChanged(request, user.userId);
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

    notifyNotificationsChanged(request, user.userId);
    return { deleted: 1 };
  });
};
