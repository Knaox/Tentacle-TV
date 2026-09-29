import type { FastifyPluginAsync } from "fastify";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getUserWatchlist, getItemDetail } from "../services/jellyfin";
import { getLikedListItems } from "../services/shareLists";
import { generateShareToken } from "../services/shareToken";
import { registerStatsOwnerRoutes, replySharedStats, sharedStatsShowsTitle } from "./shareStats";

/**
 * Les routes PUBLIQUES (sans compte) ont leur propre plafond, bien sous le
 * plafond global : une personne qui parcourt un partage n'en fait pas soixante
 * par minute, un robot qui essaierait des jetons si.
 */
const PUBLIC_RATE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };

/** La langue des étiquettes d'une page publique (genres, pays) : celle du visiteur. */
const publicQuery = z.object({ lang: z.enum(["fr", "en"]).catch("fr") });

/**
 * Ce qu'une route lit d'un lien — jamais `options`, les réglages d'un partage
 * de statistiques : sur une base où la colonne n'est pas encore posée (elle
 * arrive par core-init.sql), les listes continuent de marcher.
 */
const LINK_HEAD = { kind: true, ownerUserId: true, ownerUsername: true } as const;

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
        token: generateShareToken(),
        ownerUserId: user.userId,
        ownerUsername: user.username,
        kind,
      },
      update: { ownerUsername: user.username },
      select: { token: true },
    });
    return { token: link.token };
  });

  // ── GET /mine — état du lien courant (null si aucun) ──
  app.get(`${base}/mine`, { preHandler: [requireAuth] }, async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({
      where: { ownerUserId_kind: { ownerUserId: user.userId, kind } },
      select: { token: true },
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
  // Routes STATIQUES /likes/* et /stats/* déclarées avant les paramétriques /:token.
  registerOwnerRoutes(app, "likes", "/likes");
  registerStatsOwnerRoutes(app);

  // ── GET /:token — vue PUBLIQUE (pas d'auth), en lecture seule. La forme
  //    dépend du `kind` du lien : watchlist (projection Jellyfin historique),
  //    likes (favoris + hors bibliothèque avec affiche TMDB) ou stats (les
  //    statistiques du propriétaire, passées à la liste blanche). ──
  app.get("/:token", { config: PUBLIC_RATE_LIMIT }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({ where: { token }, select: LINK_HEAD });
    if (!link) return reply.status(404).send({ message: "Lien introuvable" });
    if (link.kind === "stats") {
      return replySharedStats(reply, { token, ...link }, publicQuery.parse(request.query ?? {}).lang);
    }

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
  //    média du partage. Sécurité : l'item doit être dans la liste partagée, ou
  //    parmi les titres que montrent les statistiques partagées (pas
  //    d'énumération de la bibliothèque via un token). ──
  app.get("/:token/item/:itemId", { config: PUBLIC_RATE_LIMIT }, async (request, reply) => {
    const { token, itemId } = request.params as { token: string; itemId: string };
    const prisma = getPrisma();
    const link = await prisma.shareLink.findUnique({ where: { token }, select: LINK_HEAD });
    if (!link) return reply.status(404).send({ message: "Lien introuvable" });

    try {
      // Contrôle d'appartenance selon le kind — toujours là pour empêcher
      // l'énumération de la bibliothèque via un token.
      const inList =
        link.kind === "stats"
          ? await sharedStatsShowsTitle({ token, ownerUserId: link.ownerUserId }, itemId)
          : link.kind === "likes"
            ? (await getLikedListItems(link.ownerUserId)).some((i) => i.Id === itemId)
            : ((await getUserWatchlist(link.ownerUserId)).Items ?? []).some((i) => i.Id === itemId);
      if (!inList) return reply.status(404).send({ message: "Média introuvable" });
      // Vue anonyme : l'historique de visionnage du propriétaire (UserData —
      // dates, compteurs, position de lecture) ne regarde pas les visiteurs.
      const detail = await getItemDetail(link.ownerUserId, itemId);
      delete detail.UserData;
      return detail;
    } catch {
      return reply.status(502).send({ message: "Média indisponible" });
    }
  });
};
