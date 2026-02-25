import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth, requireAdmin, type JellyfinUser } from "../middleware/auth";

const createTicketSchema = z.object({
  subject: z.string().min(1).max(300),
  category: z.enum(["general", "bug", "feature", "account"]).default("general"),
  body: z.string().min(1).max(5000),
  mediaItemId: z.string().max(255).optional(),
  mediaItemName: z.string().max(500).optional(),
});

const replySchema = z.object({
  body: z.string().min(1).max(5000),
});

const statusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

export const ticketRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // POST /api/tickets — Create ticket with initial message
  app.post("/", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const body = createTicketSchema.parse(request.body);

    const ticket = await prisma.supportTicket.create({
      data: {
        jellyfinUserId: user.userId,
        username: user.username,
        subject: body.subject,
        category: body.category,
        mediaItemId: body.mediaItemId,
        mediaItemName: body.mediaItemName,
        messages: {
          create: {
            jellyfinUserId: user.userId,
            username: user.username,
            isAdmin: user.isAdmin,
            body: body.body,
          },
        },
      },
      include: { messages: true },
    });

    return reply.status(201).send(ticket);
  });

  // GET /api/tickets — User's own tickets
  app.get("/", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const query = request.query as Record<string, string>;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    const where: any = { jellyfinUserId: user.userId };
    if (query.status) where.status = query.status;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { messages: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { results: tickets, total, page, totalPages: Math.ceil(total / limit) };
  });

  // GET /api/tickets/all — Admin: all tickets
  app.get("/all", { preHandler: [requireAdmin] }, async (request) => {
    const prisma = getPrisma();
    const query = request.query as Record<string, string>;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    const where: any = {};
    if (query.status) where.status = query.status;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { messages: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { results: tickets, total, page, totalPages: Math.ceil(total / limit) };
  });

  // GET /api/tickets/:id — Get ticket detail + messages
  app.get("/:id", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { id } = request.params as { id: string };

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!ticket) {
      return reply.status(404).send({ message: "Ticket introuvable" });
    }

    // Only owner or admin
    if (ticket.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    return ticket;
  });

  // POST /api/tickets/:id/reply — Add a message
  app.post("/:id/reply", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { id } = request.params as { id: string };
    const body = replySchema.parse(request.body);

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      return reply.status(404).send({ message: "Ticket introuvable" });
    }

    if (ticket.jellyfinUserId !== user.userId && !user.isAdmin) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    if (ticket.status === "closed") {
      return reply.status(400).send({ message: "Ce ticket est fermé" });
    }

    const [message] = await Promise.all([
      prisma.ticketMessage.create({
        data: {
          ticketId: id,
          jellyfinUserId: user.userId,
          username: user.username,
          isAdmin: user.isAdmin,
          body: body.body,
        },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Notify the other party
    const notifyUserId = user.isAdmin ? ticket.jellyfinUserId : null; // admin replies → notify user
    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          jellyfinUserId: notifyUserId,
          type: "ticket_reply",
          title: `Réponse sur "${ticket.subject}"`,
          body: body.body.slice(0, 200),
          refId: id,
        },
      });
    }

    return reply.status(201).send(message);
  });

  // PATCH /api/tickets/:id/status — Admin: update ticket status
  app.patch("/:id/status", { preHandler: [requireAdmin] }, async (request, reply) => {
    const prisma = getPrisma();
    const { id } = request.params as { id: string };
    const body = statusSchema.parse(request.body);

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      return reply.status(404).send({ message: "Ticket introuvable" });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status: body.status },
    });

    // Notify ticket owner
    const statusLabels: Record<string, string> = {
      open: "Ouvert",
      in_progress: "En cours",
      resolved: "Résolu",
      closed: "Fermé",
    };

    await prisma.notification.create({
      data: {
        jellyfinUserId: ticket.jellyfinUserId,
        type: "ticket_status",
        title: `Ticket "${ticket.subject}" — ${statusLabels[body.status]}`,
        refId: id,
      },
    });

    return updated;
  });
};
