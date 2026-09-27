import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { requireAdmin } from "../middleware/auth";

/**
 * Invitations : création, liste et suppression, réservées à l'administration.
 *
 * Le contrat de la liste est `AdminInviteDto` (`packages/shared/src/adminInvites/
 * invites.ts`). Le backend ne dépend pas de `@tentacle-tv/shared` (tsc CommonJS,
 * image Docker sans packages/) : les bornes ci-dessous y sont RECOPIÉES, et
 * `invites.test.ts` échoue si les deux côtés divergent — le formulaire du web
 * les applique avant l'envoi.
 */
export const INVITE_MAX_USES_LIMIT = 100;
/** 30 jours. */
export const INVITE_EXPIRY_HOURS_LIMIT = 720;

const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(INVITE_MAX_USES_LIMIT).default(1),
  expiresInHours: z.number().int().min(1).max(INVITE_EXPIRY_HOURS_LIMIT).optional(),
});

/** L'administrateur authentifié, posé par `requireAdmin`. */
function adminName(request: FastifyRequest): string | null {
  const user = (request as FastifyRequest & { user?: { username?: string } }).user;
  return user?.username ?? null;
}

export const inviteRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.post("/", async (request, reply) => {
    const prisma = getPrisma();
    const body = createInviteSchema.parse(request.body);

    const key = crypto.randomBytes(8).toString("hex");
    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
      : undefined;

    const invite = await prisma.inviteKey.create({
      data: {
        key,
        maxUses: body.maxUses,
        expiresAt,
        // La colonne existait sans jamais être renseignée : sur un serveur à
        // plusieurs administrateurs, la liste dit désormais qui a invité.
        createdBy: adminName(request),
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
    const prisma = getPrisma();
    const invites = await prisma.inviteKey.findMany({
      include: { usages: { orderBy: { usedAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return invites.map((inv) => ({
      id: inv.id,
      key: inv.key,
      maxUses: inv.maxUses,
      currentUses: inv.currentUses,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      createdBy: inv.createdBy,
      usages: inv.usages.map((u) => ({
        username: u.username,
        usedAt: u.usedAt,
        // Additif (1.19.3) : l'identifiant du compte créé, pour que la liste
        // montre son avatar plutôt qu'un nom nu.
        jellyfinUserId: u.jellyfinUserId,
      })),
    }));
  });

  // Suppression d'une invitation (admin). InviteUsage n'a pas de onDelete: Cascade
  // → on supprime d'abord ses usages dans une transaction pour éviter la violation FK.
  // Les comptes créés avec l'invitation, eux, restent intacts.
  app.delete("/:id", async (request, reply) => {
    const prisma = getPrisma();
    const { id } = request.params as { id: string };
    const invite = await prisma.inviteKey.findUnique({ where: { id } });
    if (!invite) return reply.status(404).send({ message: "Invitation introuvable" });
    await prisma.$transaction([
      prisma.inviteUsage.deleteMany({ where: { inviteKeyId: id } }),
      prisma.inviteKey.delete({ where: { id } }),
    ]);
    return { success: true };
  });
};
