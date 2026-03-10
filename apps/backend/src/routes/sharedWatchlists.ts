import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { listJellyfinUsers, getUserItemsBatch } from "../services/jellyfin";

const createBody = z.object({ name: z.string().min(1).max(100) });
const renameBody = z.object({ name: z.string().min(1).max(100) });
const addMemberBody = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  role: z.enum(["contributor", "reader"]).default("reader"),
});
const updateRoleBody = z.object({ role: z.enum(["contributor", "reader"]) });
const addItemBody = z.object({ jellyfinItemId: z.string().min(1) });
const batchAddBody = z.object({
  jellyfinItemId: z.string().min(1),
  watchlistIds: z.array(z.string().min(1)).min(1),
});

type ListRole = "creator" | "contributor" | "reader";
type ListAccess = { list: { id: string; name: string; creatorId: string } | null; role: ListRole | null };

async function getListAccess(watchlistId: string, userId: string): Promise<ListAccess> {
  const prisma = getPrisma();
  const list = await prisma.sharedWatchlist.findUnique({ where: { id: watchlistId } });
  if (!list) return { list: null, role: null };
  if (list.creatorId === userId) return { list, role: "creator" };
  const member = await prisma.sharedWatchlistMember.findUnique({
    where: { watchlistId_userId: { watchlistId, userId } },
  });
  return { list, role: member ? (member.role as ListRole) : null };
}

function getUser(request: unknown): JellyfinUser {
  return (request as any).user as JellyfinUser;
}

export const sharedWatchlistRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/users", async (request) => {
    const user = getUser(request);
    return (await listJellyfinUsers()).filter((u) => u.Id !== user.userId);
  });

  app.post("/", async (request) => {
    const user = getUser(request);
    const { name } = createBody.parse(request.body);
    return getPrisma().sharedWatchlist.create({
      data: { name, creatorId: user.userId, creatorUsername: user.username },
    });
  });

  app.get("/", async (request) => {
    const prisma = getPrisma();
    const user = getUser(request);
    const [created, memberships] = await Promise.all([
      prisma.sharedWatchlist.findMany({
        where: { creatorId: user.userId },
        include: { _count: { select: { members: true, items: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sharedWatchlistMember.findMany({
        where: { userId: user.userId },
        include: { watchlist: { include: { _count: { select: { members: true, items: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return [
      ...created.map((w) => ({
        id: w.id, name: w.name, creatorId: w.creatorId, creatorUsername: w.creatorUsername,
        memberCount: w._count.members, itemCount: w._count.items, myRole: "creator" as const,
      })),
      ...memberships.map((m) => ({
        id: m.watchlist.id, name: m.watchlist.name, creatorId: m.watchlist.creatorId,
        creatorUsername: m.watchlist.creatorUsername, memberCount: m.watchlist._count.members,
        itemCount: m.watchlist._count.items, myRole: m.role as "contributor" | "reader",
      })),
    ];
  });

  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { name } = renameBody.parse(request.body);
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (role !== "creator") return reply.status(403).send({ message: "Seul le créateur peut renommer" });
    return getPrisma().sharedWatchlist.update({ where: { id }, data: { name } });
  });

  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (role !== "creator") return reply.status(403).send({ message: "Seul le créateur peut supprimer" });
    await getPrisma().sharedWatchlist.delete({ where: { id } });
    return { success: true };
  });

  app.get("/:id/members", async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (!role) return reply.status(403).send({ message: "Non autorisé" });
    return getPrisma().sharedWatchlistMember.findMany({ where: { watchlistId: id }, orderBy: { createdAt: "asc" } });
  });

  app.post("/:id/members", async (request, reply) => {
    const prisma = getPrisma();
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = addMemberBody.parse(request.body);
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (role !== "creator") return reply.status(403).send({ message: "Seul le créateur peut inviter" });
    if (body.userId === user.userId) return reply.status(400).send({ message: "Impossible de s'inviter soi-même" });
    const member = await prisma.sharedWatchlistMember.create({
      data: { watchlistId: id, userId: body.userId, username: body.username, role: body.role },
    });
    await prisma.notification.create({
      data: {
        jellyfinUserId: body.userId, type: "watchlist_share",
        title: `${user.username} vous a invité dans la liste "${list.name}"`, refId: list.id,
      },
    });
    return member;
  });

  app.patch("/:id/members/:memberId", async (request, reply) => {
    const user = getUser(request);
    const { id, memberId } = request.params as { id: string; memberId: string };
    const { role: r } = updateRoleBody.parse(request.body);
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (role !== "creator") return reply.status(403).send({ message: "Seul le créateur peut modifier les rôles" });
    return getPrisma().sharedWatchlistMember.update({ where: { id: memberId }, data: { role: r } });
  });

  app.delete("/:id/members/:memberId", async (request, reply) => {
    const prisma = getPrisma();
    const user = getUser(request);
    const { id, memberId } = request.params as { id: string; memberId: string };
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    const member = await prisma.sharedWatchlistMember.findUnique({ where: { id: memberId } });
    if (!member || member.watchlistId !== id) return reply.status(404).send({ message: "Membre introuvable" });
    if (role !== "creator" && member.userId !== user.userId) return reply.status(403).send({ message: "Non autorisé" });
    await prisma.sharedWatchlistMember.delete({ where: { id: memberId } });
    return { success: true };
  });

  app.get("/:id/items", async (request, reply) => {
    const prisma = getPrisma();
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (!role) return reply.status(403).send({ message: "Non autorisé" });
    const items = await prisma.sharedWatchlistItem.findMany({ where: { watchlistId: id }, orderBy: { createdAt: "desc" } });
    if (items.length === 0) return { items: [] };
    const itemIds = items.map((i) => i.jellyfinItemId);
    type JfItem = { Name: string; Type: string; ProductionYear?: number; ImageTags?: Record<string, string>; UserData?: { Played: boolean; IsFavorite: boolean; Likes?: boolean } };
    const jellyfinMap: Record<string, JfItem> = {};
    try {
      const jfData = await getUserItemsBatch(user.userId, itemIds);
      for (const jfItem of jfData.Items) jellyfinMap[jfItem.Id] = jfItem;
    } catch { /* fallback: return DB data without enrichment */ }
    return {
      items: items.map((item) => {
        const jf = jellyfinMap[item.jellyfinItemId];
        return {
          id: item.id, jellyfinItemId: item.jellyfinItemId,
          name: jf?.Name ?? "Inconnu", type: jf?.Type ?? "Unknown",
          year: jf?.ProductionYear, imageTag: jf?.ImageTags?.Primary,
          addedById: item.addedById, addedByUsername: item.addedByUsername,
          userData: jf?.UserData ? { played: jf.UserData.Played, isFavorite: jf.UserData.IsFavorite, likes: jf.UserData.Likes === true } : undefined,
          createdAt: item.createdAt.toISOString(),
        };
      }),
    };
  });

  app.post("/:id/items", async (request, reply) => {
    const prisma = getPrisma();
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const { jellyfinItemId } = addItemBody.parse(request.body);
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (!role || role === "reader") return reply.status(403).send({ message: "Seuls le créateur et les contributeurs peuvent ajouter" });
    const existing = await prisma.sharedWatchlistItem.findUnique({
      where: { watchlistId_jellyfinItemId: { watchlistId: id, jellyfinItemId } },
    });
    if (existing) return reply.status(409).send({ message: "Média déjà dans la liste" });
    return prisma.sharedWatchlistItem.create({
      data: { watchlistId: id, jellyfinItemId, addedById: user.userId, addedByUsername: user.username },
    });
  });

  app.delete("/:id/items/:itemId", async (request, reply) => {
    const prisma = getPrisma();
    const user = getUser(request);
    const { id, itemId } = request.params as { id: string; itemId: string };
    const { list, role } = await getListAccess(id, user.userId);
    if (!list) return reply.status(404).send({ message: "Liste introuvable" });
    if (role !== "creator") return reply.status(403).send({ message: "Seul le créateur peut retirer des médias" });
    const item = await prisma.sharedWatchlistItem.findUnique({ where: { id: itemId } });
    if (!item || item.watchlistId !== id) return reply.status(404).send({ message: "Item introuvable" });
    await prisma.sharedWatchlistItem.delete({ where: { id: itemId } });
    return { success: true };
  });

  app.post("/batch-add", async (request) => {
    const prisma = getPrisma();
    const user = getUser(request);
    const body = batchAddBody.parse(request.body);
    const added: string[] = [], skipped: string[] = [], forbidden: string[] = [];
    for (const wid of body.watchlistIds) {
      const { list, role } = await getListAccess(wid, user.userId);
      if (!list || !role || role === "reader") { forbidden.push(wid); continue; }
      const exists = await prisma.sharedWatchlistItem.findUnique({
        where: { watchlistId_jellyfinItemId: { watchlistId: wid, jellyfinItemId: body.jellyfinItemId } },
      });
      if (exists) { skipped.push(wid); continue; }
      await prisma.sharedWatchlistItem.create({
        data: { watchlistId: wid, jellyfinItemId: body.jellyfinItemId, addedById: user.userId, addedByUsername: user.username },
      });
      added.push(wid);
    }
    return { added, skipped, forbidden };
  });
};
