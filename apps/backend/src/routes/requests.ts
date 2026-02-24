import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireAdmin, type JellyfinUser } from "../middleware/auth";

const prisma = new PrismaClient();

const createRequestSchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  posterPath: z.string().max(500).optional(),
});

export const requestRoutes: FastifyPluginAsync = async (app) => {
  // All routes require authentication
  app.addHook("preHandler", requireAuth);

  // POST /api/requests — Create a new media request
  app.post("/", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const body = createRequestSchema.parse(request.body);

    // Check for duplicate
    const existing = await prisma.mediaRequest.findFirst({
      where: {
        tmdbId: body.tmdbId,
        mediaType: body.mediaType,
        jellyfinUserId: user.userId,
        status: { notIn: ["failed", "declined"] },
      },
    });

    if (existing) {
      return reply.status(409).send({
        message: "Vous avez déjà une demande en cours pour ce média",
        request: existing,
      });
    }

    const req = await prisma.mediaRequest.create({
      data: {
        jellyfinUserId: user.userId,
        username: user.userId, // Will be enriched by the frontend
        mediaType: body.mediaType,
        tmdbId: body.tmdbId,
        title: body.title,
        posterPath: body.posterPath ?? null,
      },
    });

    return reply.status(201).send(req);
  });

  // GET /api/requests — List user's own requests
  app.get("/", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const query = request.query as Record<string, string>;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const status = query.status || undefined;

    const where: any = { jellyfinUserId: user.userId };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.mediaRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mediaRequest.count({ where }),
    ]);

    return { results: requests, total, page, totalPages: Math.ceil(total / limit) };
  });

  // GET /api/requests/all — Admin: list all requests
  app.get("/all", { preHandler: [requireAdmin] }, async (request) => {
    const query = request.query as Record<string, string>;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const status = query.status || undefined;

    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.mediaRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mediaRequest.count({ where }),
    ]);

    return { results: requests, total, page, totalPages: Math.ceil(total / limit) };
  });

  // DELETE /api/requests/:id — Cancel own request (or admin can cancel any)
  app.delete("/:id", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const { id } = request.params as { id: string };

    const req = await prisma.mediaRequest.findUnique({ where: { id } });
    if (!req) {
      return reply.status(404).send({ message: "Demande introuvable" });
    }

    // Only owner or admin can cancel
    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    // Can only cancel pending or failed requests
    if (!["pending", "failed", "submitted"].includes(req.status)) {
      return reply.status(400).send({ message: "Impossible d'annuler une demande déjà traitée" });
    }

    await prisma.mediaRequest.delete({ where: { id } });
    return { success: true };
  });

  // POST /api/requests/:id/retry — Retry a failed request
  app.post("/:id/retry", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const { id } = request.params as { id: string };

    const req = await prisma.mediaRequest.findUnique({ where: { id } });
    if (!req) {
      return reply.status(404).send({ message: "Demande introuvable" });
    }

    if (req.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    if (req.status !== "failed") {
      return reply.status(400).send({ message: "Seules les demandes échouées peuvent être relancées" });
    }

    const updated = await prisma.mediaRequest.update({
      where: { id },
      data: { status: "pending", retryCount: 0, lastError: null },
    });

    return updated;
  });
};
