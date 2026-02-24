import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { createJellyfinUser } from "../services/jellyfin";

const prisma = new PrismaClient();

const registerSchema = z.object({
  inviteKey: z.string().min(1),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // 1. Validate invite key
    const invite = await prisma.inviteKey.findUnique({
      where: { key: body.inviteKey },
    });

    if (!invite) {
      return reply.status(400).send({ message: "Invalid invite key" });
    }

    if (invite.currentUses >= invite.maxUses) {
      return reply.status(400).send({ message: "Invite key has been fully used" });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return reply.status(400).send({ message: "Invite key has expired" });
    }

    // 2. Create user on Jellyfin via Admin API
    let jellyfinUser;
    try {
      jellyfinUser = await createJellyfinUser(body.username, body.password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      return reply.status(500).send({ message });
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
      message: "Account created successfully",
      userId: jellyfinUser.Id,
    });
  });
};
