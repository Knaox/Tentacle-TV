import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { requireAuth } from "../middleware/auth";
import { clearSessionCookie } from "./authCookie";

/** Cycle de vie du compte : création par invitation, suppression, demande de
 *  réinitialisation. Séparé de `auth.ts`, qui ne garde que la session. */

const registerSchema = z.object({
  inviteKey: z.string().min(1),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

const resetRequestSchema = z.object({ username: z.string().min(1) });

export const authAccountRoutes: FastifyPluginAsync = async (app) => {
  /** POST /api/auth/register — Create a Jellyfin user with an invite key. */
  app.post("/register", { config: { rateLimit: { max: 3, timeWindow: 60000 } } }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const prisma = getPrisma();
    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();

    if (!jellyfinUrl || !apiKey) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    // 1. Validate invite key
    const invite = await prisma.inviteKey.findUnique({
      where: { key: body.inviteKey },
    });

    if (!invite) {
      return reply.status(400).send({ message: "Clé d'invitation invalide" });
    }
    if (invite.currentUses >= invite.maxUses) {
      return reply.status(400).send({ message: "Clé d'invitation épuisée" });
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return reply.status(400).send({ message: "Clé d'invitation expirée" });
    }

    // 2. Create user on Jellyfin
    let jellyfinUser: { Id: string; Name: string };
    try {
      const createRes = await fetch(`${jellyfinUrl}/Users/New`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Emby-Token": apiKey },
        body: JSON.stringify({ Name: body.username }),
      });
      if (!createRes.ok) throw new Error(await createRes.text());
      jellyfinUser = await createRes.json();

      await fetch(`${jellyfinUrl}/Users/${jellyfinUser.Id}/Password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Emby-Token": apiKey },
        body: JSON.stringify({ NewPw: body.password, ResetPassword: false }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de création du compte";
      return reply.status(500).send({ message: msg });
    }

    // 3. Mark invite key as used
    await prisma.$transaction([
      prisma.inviteKey.update({
        where: { id: invite.id },
        data: { currentUses: { increment: 1 } },
      }),
      prisma.inviteUsage.create({
        data: {
          inviteKeyId: invite.id,
          jellyfinUserId: jellyfinUser.Id,
          username: body.username,
        },
      }),
    ]);

    return reply.status(201).send({
      message: "Compte créé avec succès",
      userId: jellyfinUser.Id,
    });
  });

  /** DELETE /api/auth/account — Delete user account (Jellyfin + Tentacle DB). */
  app.delete("/account", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as { userId: string; username: string; isAdmin: boolean };

    // Prevent admin self-deletion
    if (user.isAdmin) {
      return reply.status(403).send({
        message: "Les administrateurs ne peuvent pas supprimer leur propre compte",
      });
    }

    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();

    if (!jellyfinUrl || !apiKey) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    // 1. Delete user from Jellyfin
    try {
      const res = await fetch(`${jellyfinUrl}/Users/${user.userId}`, {
        method: "DELETE",
        headers: { "X-Emby-Token": apiKey },
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Jellyfin responded with ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de suppression Jellyfin";
      return reply.status(500).send({ message: msg });
    }

    // 2. Clean up Tentacle DB data
    const prisma = getPrisma();
    try {
      await prisma.$transaction([
        prisma.libraryPreference.deleteMany({ where: { jellyfinUserId: user.userId } }),
        prisma.pairedDevice.deleteMany({ where: { jellyfinUserId: user.userId } }),
        prisma.notification.deleteMany({ where: { jellyfinUserId: user.userId } }),
        prisma.inviteUsage.deleteMany({ where: { jellyfinUserId: user.userId } }),
      ]);
      // Delete ticket messages then tickets (cascade handles messages)
      const tickets = await prisma.supportTicket.findMany({
        where: { jellyfinUserId: user.userId },
        select: { id: true },
      });
      if (tickets.length > 0) {
        await prisma.supportTicket.deleteMany({ where: { jellyfinUserId: user.userId } });
      }
    } catch {
      // Non-blocking: Jellyfin user is already deleted
    }

    clearSessionCookie(reply);
    return { success: true, message: "Compte supprimé" };
  });

  /** POST /api/auth/password-reset-request — Create a support ticket for password reset. */
  app.post("/password-reset-request", {
    config: { rateLimit: { max: 3, timeWindow: 3_600_000 } },
  }, async (request, reply) => {
    const { username } = resetRequestSchema.parse(request.body);
    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();

    // Always respond 200 to avoid leaking user existence
    const successResponse = { message: "Demande enregistrée" };

    if (!jellyfinUrl || !apiKey) {
      return reply.send(successResponse);
    }

    try {
      const res = await fetch(`${jellyfinUrl}/Users`, {
        headers: { "X-Emby-Token": apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return reply.send(successResponse);

      const users = (await res.json()) as { Id: string; Name: string }[];
      const match = users.find(
        (u) => u.Name.toLowerCase() === username.toLowerCase()
      );
      if (!match) return reply.send(successResponse);

      const prisma = getPrisma();
      await prisma.supportTicket.create({
        data: {
          jellyfinUserId: match.Id,
          username: match.Name,
          subject: "Réinitialisation de mot de passe",
          category: "account",
          status: "open",
          messages: {
            create: {
              jellyfinUserId: match.Id,
              username: match.Name,
              isAdmin: false,
              body: `L'utilisateur ${match.Name} demande une réinitialisation de son mot de passe.`,
            },
          },
        },
      });

      return reply.send(successResponse);
    } catch {
      return reply.send(successResponse);
    }
  });
};
