import type { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getUserWatchlist, getItemDetail } from "../services/jellyfin";

function generateToken(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * « Partager ma liste » — lien de partage de la watchlist personnelle.
 *
 * Le lien est Live : à l'ouverture (GET public), on relit la watchlist Jellyfin
 * du propriétaire via la clé admin (getUserWatchlist). Aucun item n'est stocké.
 * 1 seul lien actif par propriétaire (upsert sur ownerUserId).
 */
export const shareRoutes: FastifyPluginAsync = async (app) => {
  // ── POST / — crée (ou récupère) le lien du user courant ──
  app.post("/", { preHandler: [requireAuth] }, async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const link = await prisma.shareLink.upsert({
      where: { ownerUserId: user.userId },
      create: {
        token: generateToken(),
        ownerUserId: user.userId,
        ownerUsername: user.username,
      },
      update: { ownerUsername: user.username },
    });
    return { token: link.token };
  });

  // ── GET /mine — état du lien courant (null si aucun) ──
  app.get("/mine", { preHandler: [requireAuth] }, async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({ where: { ownerUserId: user.userId } });
    return { token: link?.token ?? null };
  });

  // ── DELETE / — révoque le lien du user courant ──
  app.delete("/", { preHandler: [requireAuth] }, async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    await prisma.shareLink.deleteMany({ where: { ownerUserId: user.userId } });
    return { ok: true };
  });

  // ── GET /:token — vue PUBLIQUE (pas d'auth) de la liste, en lecture seule ──
  app.get("/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({ where: { token } });
    if (!link) return reply.status(404).send({ message: "Lien introuvable" });

    try {
      const data = await getUserWatchlist(link.ownerUserId);
      const items = (data.Items ?? []).map((i) => ({
        Id: i.Id,
        Name: i.Name,
        Type: i.Type,
        ProductionYear: i.ProductionYear,
        ImageTags: i.ImageTags,
      }));
      return { ownerUsername: link.ownerUsername, items };
    } catch {
      return reply.status(502).send({ message: "Liste indisponible" });
    }
  });

  // ── GET /:token/item/:itemId — détail PUBLIC (résumé + bandes-annonces) d'un
  //    média de la liste partagée. Sécurité : l'item doit être dans la watchlist
  //    du propriétaire (pas d'énumération de la bibliothèque via un token). ──
  app.get("/:token/item/:itemId", async (request, reply) => {
    const { token, itemId } = request.params as { token: string; itemId: string };
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({ where: { token } });
    if (!link) return reply.status(404).send({ message: "Lien introuvable" });

    try {
      const wl = await getUserWatchlist(link.ownerUserId);
      const inList = (wl.Items ?? []).some((i) => i.Id === itemId);
      if (!inList) return reply.status(404).send({ message: "Média introuvable" });
      return await getItemDetail(link.ownerUserId, itemId);
    } catch {
      return reply.status(502).send({ message: "Média indisponible" });
    }
  });
};
