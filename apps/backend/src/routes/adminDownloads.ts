/**
 * Administration des téléchargements. Les DROITS se lisent et s'écrivent DANS
 * Jellyfin (aucune copie Tentacle — voir jellyfinAdminPolicy.ts pour la règle
 * GET-merge-POST intégral). Le PLAFOND DE DÉBIT, lui, n'a pas d'équivalent
 * Jellyfin : c'est un réglage du serveur Tentacle, dans sa table de
 * configuration. Réservé aux admins (contexte admin : les erreurs sont
 * parlantes ici, contrairement aux routes utilisateur).
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { deleteConfigValue, getDownloadBandwidthConfig, setConfigValue } from "../services/configStore";
import { DOWNLOAD_BANDWIDTH_KEYS, MAX_CAP_BPS, MIN_CAP_BPS, type PoolId } from "../services/downloadBandwidth/caps";
import { listUsersRights, updateUserRights } from "../services/jellyfinAdminPolicy";

const patchSchema = z
  .object({
    enableContentDownloading: z.boolean().optional(),
    enableMediaConversion: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.enableContentDownloading !== undefined ||
      value.enableMediaConversion !== undefined,
    { message: "empty patch" },
  );

/** Un plafond : octets par seconde, entier borné, ou `null` = illimité. */
const capSchema = z.number().int().min(MIN_CAP_BPS).max(MAX_CAP_BPS).nullable();
/** L'état COMPLET des deux plafonds — un PUT remplace tout, pas de patch. */
const bandwidthSchema = z.object({ external: capSchema, internal: capSchema });
const POOLS: readonly PoolId[] = ["external", "internal"];

const STATUS_BY_ERROR: Record<string, number> = {
  "jellyfin-not-configured": 503,
  "admin-key-missing": 503,
  "jellyfin-unreachable": 502,
  "user-not-found": 404,
  "policy-missing": 502,
  "update-failed": 502,
  "verify-failed": 502,
};

export const adminDownloadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.get("/users", async (_request, reply) => {
    try {
      return await listUsersRights();
    } catch (error) {
      const code = error instanceof Error ? error.message : "jellyfin-unreachable";
      return reply.status(STATUS_BY_ERROR[code] ?? 502).send({ error: code });
    }
  });

  app.put("/users/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    if (!/^[0-9a-fA-F-]{32,36}$/.test(userId)) {
      return reply.status(400).send({ error: "invalid-user" });
    }
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-patch" });
    }
    try {
      return await updateUserRights(userId, parsed.data);
    } catch (error) {
      const code = error instanceof Error ? error.message : "update-failed";
      return reply.status(STATUS_BY_ERROR[code] ?? 502).send({ error: code });
    }
  });

  /** GET /bandwidth → `{ external, internal }` en octets/s, `null` = illimité. */
  app.get("/bandwidth", async () => getDownloadBandwidthConfig());

  /**
   * PUT /bandwidth — pris en compte au tick suivant par les transferts en
   * cours (l'arbitre relit la configuration à chaque tick). Illimité = clé
   * effacée, pas une valeur « 0 » qui traînerait.
   */
  app.put("/bandwidth", async (request, reply) => {
    const parsed = bandwidthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-bandwidth" });
    }
    for (const pool of POOLS) {
      const value = parsed.data[pool];
      if (value === null) await deleteConfigValue(DOWNLOAD_BANDWIDTH_KEYS[pool]);
      else await setConfigValue(DOWNLOAD_BANDWIDTH_KEYS[pool], String(value));
    }
    return getDownloadBandwidthConfig();
  });
};
