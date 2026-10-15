/**
 * GET /api/playback/rights — les droits de lecture du compte pour CE client
 * (docs/DROITS-UTILISATEURS.md § 9.2, capacité `playback.rights`) : lecture,
 * conversions de l'image et du son, changement de conteneur, plafond de débit
 * d'après l'adresse réelle du client. Les lecteurs s'en servent pour ne jamais
 * demander un mode refusé et dire pourquoi ; le proxy, lui, les applique
 * (`jellyfinProxy/playbackGate.ts`).
 */

import type { FastifyPluginAsync } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { getRealClientIp } from "../services/networkUtils";
import { playbackRightsFor } from "../services/playbackRights";
import type { PlaybackRights } from "../playback/playbackRights";

export const playbackRightsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/rights", async (request, reply): Promise<PlaybackRights> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    // Propres au compte ET à l'adresse : jamais servis d'un cache partagé.
    reply.header("cache-control", "private, no-store");
    return playbackRightsFor(user.userId, getRealClientIp(request));
  });
};
