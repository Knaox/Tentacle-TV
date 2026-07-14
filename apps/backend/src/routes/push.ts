import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { sendToUser } from "../services/pushService";

const registerSchema = z.object({
  token: z.string().min(1).max(255),
  platform: z.enum(["ios", "android"]),
});

const prefsSchema = z.object({
  libraryAdded: z.boolean().optional(),
  seerAvailable: z.boolean().optional(),
});

const DEFAULT_PREFS = { libraryAdded: false, seerAvailable: false };

export const pushRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // POST /api/push/register — enregistre / rafraîchit le token Expo de l'appareil.
  app.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "token + platform (ios|android) requis" });
    }
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const { token, platform } = parsed.data;

    await prisma.pushDevice.upsert({
      where: { expoPushToken: token },
      update: { jellyfinUserId: user.userId, platform, lastSeen: new Date() },
      create: { jellyfinUserId: user.userId, expoPushToken: token, platform },
    });

    return { success: true };
  });

  // GET /api/push/preferences — préférences de notification (défaut : tout off).
  app.get("/preferences", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const pref = await prisma.notificationPreference.findUnique({
      where: { jellyfinUserId: user.userId },
    });
    return pref
      ? { libraryAdded: pref.libraryAdded, seerAvailable: pref.seerAvailable }
      : DEFAULT_PREFS;
  });

  // PUT /api/push/preferences — mise à jour partielle des préférences.
  app.put("/preferences", async (request, reply) => {
    const parsed = prefsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "libraryAdded / seerAvailable booléens" });
    }
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();

    const pref = await prisma.notificationPreference.upsert({
      where: { jellyfinUserId: user.userId },
      update: parsed.data,
      create: { jellyfinUserId: user.userId, ...DEFAULT_PREFS, ...parsed.data },
    });
    return { libraryAdded: pref.libraryAdded, seerAvailable: pref.seerAvailable };
  });

  // POST /api/push/test — envoie une notif de test aux appareils de l'utilisateur.
  // reason:"no_device" permet à l'app d'inviter à autoriser/enregistrer d'abord.
  app.post("/test", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const result = await sendToUser(user.userId, {
      title: "Tentacle TV",
      body: "Notification de test ✓",
      data: { type: "test" },
    });
    return result.sent === 0 ? { sent: 0, reason: "no_device" } : { sent: result.sent };
  });
};
