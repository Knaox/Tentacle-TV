import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";

const registerSchema = z.object({
  inviteKey: z.string().min(1),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  /** POST /api/auth/login — Authenticate via Jellyfin, return token + user. */
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    try {
      const res = await fetch(`${jellyfinUrl}/Users/AuthenticateByName`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Username: body.username, Pw: body.password }),
      });

      if (!res.ok) {
        const status = res.status === 401 ? 401 : 400;
        return reply.status(status).send({ message: "Identifiants invalides" });
      }

      const data = await res.json();
      return {
        AccessToken: data.AccessToken,
        User: data.User,
        ServerId: data.ServerId,
      };
    } catch {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
  });

  /** POST /api/auth/register — Create a Jellyfin user with an invite key. */
  app.post("/register", async (request, reply) => {
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
};
