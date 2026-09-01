import type { FastifyPluginAsync } from "fastify";
import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getUserWatchlist, getItemDetail } from "../services/jellyfin";
import { getLikedListItems } from "../services/shareLists";

function generateToken(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Liens de partage de listes — watchlist (« Ma liste ») et titres likés
 * (favoris + likes hors bibliothèque). MÊME mécanisme, paramétré par `kind` :
 * un lien actif par (propriétaire, liste), résolution Live à l'ouverture via
 * la clé admin, aucun item stocké, révocation = suppression (404 ensuite).
 */
function registerOwnerRoutes(app: FastifyInstance, kind: "watchlist" | "likes", base: string): void {
  // ── POST — crée (ou récupère) le lien du user courant ──
  app.post(`${base}/`, { preHandler: [requireAuth] }, async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const link = await prisma.shareLink.upsert({
      where: { ownerUserId_kind: { ownerUserId: user.userId, kind } },
      create: {
        token: generateToken(),
        ownerUserId: user.userId,
        ownerUsername: user.username,
        kind,
      },
      update: { ownerUsername: user.username },
    });
    return { token: link.token };
  });

  // ── GET /mine — état du lien courant (null si aucun) ──
  app.get(`${base}/mine`, { preHandler: [requireAuth] }, async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({
      where: { ownerUserId_kind: { ownerUserId: user.userId, kind } },
    });
    return { token: link?.token ?? null };
  });

  // ── DELETE — révoque le lien du user courant ──
  app.delete(`${base}/`, { preHandler: [requireAuth] }, async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    await prisma.shareLink.deleteMany({ where: { ownerUserId: user.userId, kind } });
    return { ok: true };
  });
}

export const shareRoutes: FastifyPluginAsync = async (app) => {
  registerOwnerRoutes(app, "watchlist", "");
  // Routes STATIQUES /likes/* déclarées avant les paramétriques /:token.
  registerOwnerRoutes(app, "likes", "/likes");

  // ── GET /:token — vue PUBLIQUE (pas d'auth) de la liste, en lecture seule.
  //    La forme dépend du `kind` du lien : watchlist (projection Jellyfin
  //    historique) ou likes (favoris + hors bibliothèque avec affiche TMDB). ──
  app.get("/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({ where: { token } });
    if (!link) return reply.status(404).send({ message: "Lien introuvable" });

    try {
      if (link.kind === "likes") {
        const items = await getLikedListItems(link.ownerUserId);
        return { ownerUsername: link.ownerUsername, kind: "likes", items };
      }
      const data = await getUserWatchlist(link.ownerUserId);
      const items = (data.Items ?? []).map((i) => ({
        Id: i.Id,
        Name: i.Name,
        Type: i.Type,
        ProductionYear: i.ProductionYear,
        ImageTags: i.ImageTags,
        InLibrary: true,
      }));
      return { ownerUsername: link.ownerUsername, kind: "watchlist", items };
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
      // Contrôle d'appartenance selon le kind — toujours là pour empêcher
      // l'énumération de la bibliothèque via un token.
      const inList =
        link.kind === "likes"
          ? (await getLikedListItems(link.ownerUserId)).some((i) => i.Id === itemId)
          : ((await getUserWatchlist(link.ownerUserId)).Items ?? []).some((i) => i.Id === itemId);
      if (!inList) return reply.status(404).send({ message: "Média introuvable" });
      return await getItemDetail(link.ownerUserId, itemId);
    } catch {
      return reply.status(502).send({ message: "Média indisponible" });
    }
  });
};
