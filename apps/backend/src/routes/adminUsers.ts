import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { signImpersonationToken } from "../services/jwt";

interface JellyfinUserDto {
  Id: string;
  Name: string;
  PrimaryImageTag?: string;
  LastActivityDate?: string;
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean };
}

/**
 * Routes admin "utilisateurs" — liste des comptes Jellyfin et impersonation.
 * Enregistré depuis adminRoutes : hérite du preHandler requireAdmin.
 */
export const adminUsersRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/users — Liste des utilisateurs Jellyfin. */
  app.get("/users", async (_request, reply) => {
    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();
    if (!jellyfinUrl || !apiKey) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    try {
      const res = await fetch(`${jellyfinUrl}/Users`, {
        headers: { "X-Emby-Token": apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return reply.status(502).send({ message: `Jellyfin a répondu ${res.status}` });
      }
      const users = (await res.json()) as JellyfinUserDto[];
      return users.map((u) => ({
        id: u.Id,
        name: u.Name,
        hasAvatar: !!u.PrimaryImageTag,
        lastActivityDate: u.LastActivityDate ?? null,
        isAdministrator: u.Policy?.IsAdministrator === true,
        isDisabled: u.Policy?.IsDisabled === true,
      }));
    } catch {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
  });

  /** POST /api/admin/impersonate — Démarre une session "voir en tant que".
   *  Signe un JWT court (8h, jamais admin) accepté par le proxy Jellyfin
   *  (substitué par la clé API admin) et par le backend (requireAuth). Sur web,
   *  le cookie admin actuel est sauvegardé dans tentacle_admin_token pour être
   *  restauré par POST /api/auth/impersonate/stop. */
  app.post("/impersonate", async (request, reply) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.body);
    const admin = (request as any).user as { userId: string; username: string };
    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();
    if (!jellyfinUrl || !apiKey) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }
    if (userId === admin.userId) {
      return reply.status(400).send({ message: "Impossible de s'impersonner soi-même" });
    }

    // Récupère le profil cible — sert aussi de validation d'existence.
    let target: JellyfinUserDto;
    try {
      const res = await fetch(`${jellyfinUrl}/Users/${userId}`, {
        headers: { "X-Emby-Token": apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 404) {
        return reply.status(404).send({ message: "Utilisateur introuvable" });
      }
      if (!res.ok) {
        return reply.status(502).send({ message: `Jellyfin a répondu ${res.status}` });
      }
      target = await res.json();
    } catch {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }

    // Un compte admin impersoné recevrait un token isAdmin=false : l'UI (qui lit
    // Policy.IsAdministrator du user stocké) afficherait l'admin mais le backend
    // refuserait tout — incohérence évitée en bloquant en amont.
    if (target.Policy?.IsAdministrator === true) {
      return reply.status(400).send({ message: "Impossible d'impersonner un administrateur" });
    }

    const token = await signImpersonationToken({
      userId: target.Id,
      username: target.Name,
      adminUserId: admin.userId,
      adminUsername: admin.username,
    });

    request.log.info({ admin: admin.username, target: target.Name }, "Impersonation démarrée");

    // Web : bascule les cookies httpOnly (le token admin est mis de côté).
    const currentCookie = (request as any).cookies?.tentacle_token as string | undefined;
    if (currentCookie) {
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        path: "/",
        maxAge: 400 * 24 * 60 * 60,
      };
      reply.setCookie("tentacle_admin_token", currentCookie, cookieOpts);
      reply.setCookie("tentacle_token", token, cookieOpts);
    }

    return { token, user: target };
  });
};
