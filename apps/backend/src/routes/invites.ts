import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

export const inviteRoutes: FastifyPluginAsync = async (app) => {
  // TODO: Add admin authentication middleware

  app.post("/", async (request, reply) => {
    const body = createInviteSchema.parse(request.body);

    const key = nanoid(16);
    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
      : undefined;

    const invite = await prisma.inviteKey.create({
      data: {
        key,
        maxUses: body.maxUses,
        expiresAt,
      },
    });

    return reply.status(201).send({
      id: invite.id,
      key: invite.key,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
    });
  });

  app.get("/", async () => {
    const invites = await prisma.inviteKey.findMany({
      include: { usages: true },
      orderBy: { createdAt: "desc" },
    });

    return invites.map((inv: any) => ({
      id: inv.id,
      key: inv.key,
      maxUses: inv.maxUses,
      currentUses: inv.currentUses,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      usages: inv.usages.map((u: any) => ({
        username: u.username,
        usedAt: u.usedAt,
      })),
    }));
  });
};
