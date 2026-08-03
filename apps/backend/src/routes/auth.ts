import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getJellyfinUrl } from "../services/configStore";
import { requireAuth } from "../middleware/auth";
import { verifyImpersonationToken } from "../services/jwt";
import { buildAuthHeader, deviceIdForOpaque } from "../services/jellyfinIdentity";
import { authPasswordRoutes } from "./authPassword";
import { authAccountRoutes } from "./authAccount";
import { authRefreshRoutes } from "./authRefresh";
import { clearSessionCookie, setSessionCookie } from "./authCookie";

/** Session : ouverture, sortie d'impersonation, fermeture. Le cycle de vie du
 *  compte vit dans `authAccount.ts`, la revalidation dans `authRefresh.ts` et le
 *  mot de passe dans `authPassword.ts` (limite 300 lignes par fichier). */

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  // Appareil du client (UUID rangé dans son stockage local, donc un par
  // navigateur et par origine). Optionnel : les clients antérieurs ne
  // l'envoient pas, on retombe alors sur le nom du compte. Le format est
  // contraint car la valeur finit dans un en-tête HTTP.
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authPasswordRoutes);
  await app.register(authAccountRoutes);
  await app.register(authRefreshRoutes);

  /** POST /api/auth/login — Authenticate via Jellyfin, return token + user. */
  app.post("/login", { config: { rateLimit: { max: 5, timeWindow: 60000 } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    try {
      // Une session Jellyfin par (installation, appareil, compte) — cf.
      // jellyfinIdentity. L'appareil vient du CLIENT, d'où le hachage par une
      // clé secrète du serveur : sans lui, quiconque connaîtrait l'appareil
      // d'un autre pourrait, en le rejouant ici, faire révoquer sa session par
      // Jellyfin. Le compte est haché avec, pour que deux comptes ne retombent
      // jamais sur le même identifiant.
      const deviceId = await deviceIdForOpaque("web", body.deviceId ?? body.username, body.username);
      const authHeader = buildAuthHeader({ device: "Web", deviceId });
      const res = await fetch(`${jellyfinUrl}/Users/AuthenticateByName`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({ Username: body.username, Pw: body.password }),
      });

      if (!res.ok) {
        const status = res.status === 401 ? 401 : 400;
        return reply.status(status).send({ message: "Identifiants invalides" });
      }

      const data = await res.json();

      // Set httpOnly cookie for web clients (XSS-proof token storage)
      setSessionCookie(reply, data.AccessToken);

      return {
        AccessToken: data.AccessToken,
        User: data.User,
        ServerId: data.ServerId,
      };
    } catch {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
  });

  /** POST /api/auth/impersonate/stop — Quitte le mode impersonation (web).
   *  Restaure le cookie admin sauvegardé au démarrage de l'impersonation.
   *  Volontairement hors de /api/admin : la session active porte un token
   *  d'impersonation (isAdmin=false) qui ne passerait pas requireAdmin.
   *  Pas d'escalade possible : on ne fait que réécrire tentacle_token avec
   *  un cookie httpOnly que ce même navigateur possédait déjà. */
  app.post("/impersonate/stop", async (request, reply) => {
    const cookies = (request as any).cookies as Record<string, string | undefined> | undefined;
    const adminToken = cookies?.tentacle_admin_token;

    // Clients Bearer (desktop) : le token admin est restauré côté client,
    // l'appel ne sert qu'à confirmer la fin du mode. On exige quand même un
    // token d'impersonation valide pour éviter les appels anonymes.
    if (!adminToken) {
      const bearer = request.headers.authorization?.slice(7) ?? "";
      const impersonation = bearer ? await verifyImpersonationToken(bearer) : null;
      if (!impersonation) {
        return reply.status(400).send({ message: "Aucune impersonation en cours" });
      }
      return { success: true };
    }

    setSessionCookie(reply, adminToken);
    clearSessionCookie(reply, "tentacle_admin_token");
    return { success: true };
  });

  /** POST /api/auth/logout — Invalidate Jellyfin session + clear cookie. */
  app.post("/logout", { preHandler: [requireAuth] }, async (request, reply) => {
    const jellyfinUrl = getJellyfinUrl();
    const authHeader = request.headers.authorization;
    const token = authHeader?.slice(7)
      || (request as any).cookies?.tentacle_token;

    if (jellyfinUrl && token) {
      try {
        await fetch(`${jellyfinUrl}/Sessions/Logout`, {
          method: "POST",
          headers: { "X-Emby-Token": token },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Non-blocking: Jellyfin might be unreachable
      }
    }

    clearSessionCookie(reply);
    return { success: true };
  });
};
