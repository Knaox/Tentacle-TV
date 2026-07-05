import type { FastifyPluginAsync } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { isUserOnline } from "../services/wsManager";
import { getJellyfinUsers } from "../services/watchTogether/usersCache";
import type { WtInvitableUserDto } from "../services/watchTogether/protocol";

/**
 * Watch Together — utilisateurs invitables (REST, préfixe /api/watch-together).
 * Contrairement à GET /api/admin/users (admin-only), cette route est ouverte à
 * tout utilisateur authentifié mais ne projette que le minimum nécessaire à
 * l'invitation (id, nom, avatar, présence) — jamais les politiques/rôles.
 */
export const watchTogetherUsersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** GET /users — comptes Jellyfin actifs, hors soi-même. */
  app.get("/users", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const users = await getJellyfinUsers();
    if (!users) {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
    const result: WtInvitableUserDto[] = users
      .filter((u) => !u.isDisabled && u.id !== user.userId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        hasAvatar: u.hasAvatar,
        isOnline: isUserOnline(u.id),
      }))
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.name.localeCompare(b.name));
    return result;
  });
};
