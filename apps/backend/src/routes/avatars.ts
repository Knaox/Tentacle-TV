/**
 * GET /api/avatars/device-photo — la galerie des avatars de la TV (capacité
 * `avatars.devicePhoto`) : CE compte peut-il poser sa photo depuis cet
 * appareil ? Non pour le compte de démonstration (revue Apple), qui est
 * partagé : la TV n'en montre alors ni le bouton ni la proposition. La règle
 * est celle que le proxy applique (`services/avatars/devicePhotoAllowed.ts`).
 */

import type { FastifyPluginAsync } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { devicePhotoAllowed } from "../services/avatars/devicePhotoAllowed";

export const avatarRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/device-photo", async (request, reply): Promise<{ allowed: boolean }> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    reply.header("cache-control", "private, no-store");
    return { allowed: await devicePhotoAllowed(user) };
  });
};
