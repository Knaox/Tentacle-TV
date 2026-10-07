import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import {
  setConfigValue,
  getConfigValue,
  getPublicUrl,
} from "../services/configStore";
import { adminUsersRoutes } from "./adminUsers";
import { adminProvisioningRoutes } from "./adminProvisioning";
import { adminJellyfinKeyRoutes } from "./adminJellyfinKey";
import { adminWatchTimeRoutes } from "./adminWatchTime";
import { adminSessionsRoutes } from "./adminSessions";
import { adminServicesRoutes } from "./adminServices";
import { adminJellyfinCompatRoutes } from "./adminJellyfinCompat";
import { adminJellyfinSetupRoutes } from "./adminJellyfinSetup";
import { adminSegmentPluginsRoutes } from "./adminSegmentPlugins";
import { adminServerLinksRoutes } from "./adminServerLinks";
import { adminDirectStreamingRoutes } from "./adminDirectStreaming";
import { adminServerUpdateRoutes } from "./adminServerUpdate";
import { remoteAccessRoutes } from "../remoteAccess/remoteAccessRoutes";
import { syncJellyfinCors } from "../services/jellyfinCorsSync";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  // Utilisateurs Jellyfin + impersonation (hérite du hook requireAdmin).
  await app.register(adminUsersRoutes);

  // Code de jumelage de provisionnement (hérite du hook requireAdmin).
  await app.register(adminProvisioningRoutes);

  // Santé de la clé admin Jellyfin (hérite du hook requireAdmin).
  await app.register(adminJellyfinKeyRoutes);

  // Diagnostic du collecteur de temps de visionnage (hérite de requireAdmin).
  await app.register(adminWatchTimeRoutes);

  // Sessions de lecture en direct + salles Watch Together (hérite de requireAdmin).
  await app.register(adminSessionsRoutes);

  // Jellyfin, base de données, réinitialisation (hérite de requireAdmin).
  await app.register(adminServicesRoutes);

  // Compatibilité de Jellyfin : installé, dernier publié, sondes (hérite de requireAdmin).
  await app.register(adminJellyfinCompatRoutes);

  // Réglages recommandés de Jellyfin : état réel et gestes en un clic (hérite de requireAdmin).
  await app.register(adminJellyfinSetupRoutes);

  // Détection des passages : installer / réparer les greffons (requireAdmin, puis session personnelle pour lancer).
  await app.register(adminSegmentPluginsRoutes);

  // La lecture directe : ses deux adresses, la publique facultative (hérite de requireAdmin).
  await app.register(adminDirectStreamingRoutes);

  // Liens du serveur : lien public et lecture directe, sondés (hérite de requireAdmin).
  await app.register(adminServerLinksRoutes);

  // Mise à jour du serveur : version en service, dernière publiée, installation (hérite de requireAdmin).
  await app.register(adminServerUpdateRoutes);

  // Accès à distance : réglages et test d'ouverture (requireAdmin, puis session personnelle seulement).
  await app.register(remoteAccessRoutes);

  /** GET /api/admin/public-url — Read the public server URL (DB value + env fallback). */
  app.get("/public-url", async () => {
    return {
      publicUrl: getConfigValue("public_url") ?? "",
      effectiveUrl: getPublicUrl() ?? "",
      envFallback: (process.env.TENTACLE_PUBLIC_URL ?? "").replace(/\/$/, ""),
    };
  });

  /** PUT /api/admin/public-url — Update the public server URL (stored in DB).
   *  Chaîne vide = effacer la valeur DB → repli sur TENTACLE_PUBLIC_URL. */
  app.put("/public-url", async (request, reply) => {
    const parsed = z
      .object({ publicUrl: z.string().url().or(z.literal("")) })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "URL invalide" });
    }
    await setConfigValue("public_url", parsed.data.publicUrl.replace(/\/$/, ""));
    // Le nouveau lien public entre dans les CorsHosts de Jellyfin (jamais bloquant).
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    await syncJellyfinCors({ requestOrigin: origin, trustRequestOrigin: true, logger: request.log });
    return { success: true };
  });
};
