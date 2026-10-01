import type { FastifyPluginAsync } from "fastify";
import { getJellyfinUrl } from "../services/configStore";
import { verifyImpersonationToken } from "../services/jwt";
import { pairedDeviceStatus, REVOKED_REPLY } from "../services/pairedDeviceStatus";
import { setSessionCookie } from "./authCookie";
import { jellyfinAuthHeaders } from "../services/jellyfinAuth";

/**
 * POST /api/auth/refresh — revalide le token et refait glisser le cookie.
 *
 * C'est le VERDICT qui fait autorité sur la vitalité d'une session : les
 * clients ne se déconnectent que sur un 401 venu d'ici. D'où la règle qui
 * gouverne tout ce fichier — seul un refus EXPLICITE (401/403) invalide ; un
 * Jellyfin en redémarrage, une base indisponible ou un réseau coupé renvoient
 * 503 et la session est conservée.
 */
export const authRefreshRoutes: FastifyPluginAsync = async (app) => {
  app.post("/refresh", { config: { rateLimit: { max: 20, timeWindow: 60000 } } }, async (request, reply) => {
    const body = (request.body as { token?: string } | undefined);
    const token = body?.token
      || (request as any).cookies?.tentacle_token;

    if (!token) {
      return reply.status(401).send({ message: "Token manquant" });
    }

    // JWT d'appareil appairé (TV) : Jellyfin ne connaît pas ces tokens — les
    // lui soumettre renvoyait systématiquement 401 et déconnectait la TV (qui
    // n'a pas de credentials pour se reconnecter). On valide localement :
    // signature + appareil non révoqué en DB. Token renvoyé tel quel
    // (idempotent, pas de rotation de hash).
    if (token.split(".").length === 3) {
      // Token d'impersonation : validation locale (signature + expiration).
      // Jellyfin ne connaît pas ce JWT — le lui soumettre renverrait 401 et
      // éjecterait l'admin du mode impersonation sur un simple refresh.
      const impersonation = await verifyImpersonationToken(token);
      if (impersonation) {
        return {
          AccessToken: token,
          User: { Id: impersonation.userId, Name: impersonation.username },
        };
      }

      // `revoked: true` = le SEUL feu vert de déjumelage passif des clients :
      // JWT valide mais ligne paired_devices absente ⇒ révocation réelle
      // (verdict de DB), à distinguer des 401 « aléatoires » (Jellyfin qui
      // refuse, secret en avarie) qui ne doivent JAMAIS déjumeler une TV.
      const device = await pairedDeviceStatus(token);
      if (device.status === "revoked") return reply.status(401).send(REVOKED_REPLY);
      if (device.status === "unreachable") {
        return reply.status(503).send({ message: "Base de données indisponible" });
      }
      if (device.status === "paired") {
        return {
          AccessToken: token,
          User: { Id: device.payload.userId, Name: device.payload.username },
        };
      }
      // JWT illisible (signature invalide) → on laisse Jellyfin trancher
      // ci-dessous : certains tokens Jellyfin pourraient contenir des points.
    }

    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    try {
      const res = await fetch(`${jellyfinUrl}/Users/Me`, {
        headers: jellyfinAuthHeaders(token),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        // Seul un refus explicite invalide le token. Un 5xx (Jellyfin en
        // redémarrage/maintenance) ne doit JAMAIS déconnecter les clients.
        if (res.status === 401 || res.status === 403) {
          return reply.status(401).send({ message: "Token invalide" });
        }
        return reply.status(503).send({ message: "Jellyfin indisponible" });
      }

      const user = await res.json();
      setSessionCookie(reply, token);
      return { AccessToken: token, User: user };
    } catch {
      // Jellyfin unreachable — don't invalidate the token
      return reply.status(503).send({ message: "Impossible de contacter Jellyfin" });
    }
  });
};
