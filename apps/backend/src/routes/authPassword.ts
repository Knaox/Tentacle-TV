import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getJellyfinUrl } from "../services/configStore";
import { requireAuth } from "../middleware/auth";
import { verifyDeviceToken, verifyImpersonationToken } from "../services/jwt";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

/**
 * POST /api/auth/change-password — l'utilisateur change son mot de passe
 * Jellyfin. Le mot de passe actuel est validé par Jellyfin lui-même (le token
 * de session de l'utilisateur authentifie l'appel, jamais la clé API admin).
 * Enregistré depuis authRoutes (préfixe /api/auth).
 */
export const authPasswordRoutes: FastifyPluginAsync = async (app) => {
  app.post("/change-password", {
    preHandler: [requireAuth],
    config: { rateLimit: { max: 5, timeWindow: 60000 } },
  }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);
    const user = (request as any).user as { userId: string };

    const token = request.headers.authorization?.slice(7)
      || (request as any).cookies?.tentacle_token;
    if (!token) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    // Les sessions JWT (impersonation admin, appareils appairés) n'ont pas de
    // vrai token Jellyfin : impossible de valider le mot de passe actuel, et
    // un admin impersonant ne doit pas pouvoir changer le mot de passe d'un
    // utilisateur à son insu.
    if (token.split(".").length === 3) {
      const isJwtSession =
        (await verifyImpersonationToken(token)) || (await verifyDeviceToken(token));
      if (isJwtSession) {
        return reply.status(403).send({ message: "Indisponible dans cette session" });
      }
    }

    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    try {
      const res = await fetch(`${jellyfinUrl}/Users/${user.userId}/Password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Emby-Token": token },
        body: JSON.stringify({ CurrentPw: body.currentPassword, NewPw: body.newPassword }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.status === 401 || res.status === 403) {
        return reply.status(400).send({ message: "Mot de passe actuel incorrect" });
      }
      if (!res.ok) {
        return reply.status(502).send({ message: `Jellyfin a répondu ${res.status}` });
      }

      request.log.info({ userId: user.userId }, "Mot de passe modifié");
      return { success: true };
    } catch {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
  });
};
