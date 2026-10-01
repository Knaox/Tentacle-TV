import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../services/db";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import type { JellyfinUser } from "../../middleware/auth";
import { revokeDeviceByTokenHash } from "../../services/wsManager";

/** Ce que la liste des appareils montre d'un jumelage — jamais un jeton. */
function toView(d: {
  id: string;
  name: string;
  username: string;
  jellyfinUserId: string;
  lastSeen: Date;
  createdAt: Date;
}) {
  return {
    id: d.id,
    name: d.name,
    username: d.username,
    jellyfinUserId: d.jellyfinUserId,
    lastSeen: d.lastSeen,
    createdAt: d.createdAt,
  };
}

/** Les appareils jumelés : ceux du compte, et tous pour l'admin. Extrait de
 *  `pair.ts`. */
export const pairedDevicesRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /my-devices — List current user's paired devices (auth required) ──
  app.get(
    "/my-devices",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = (request as unknown as { user: JellyfinUser }).user;
      const devices = await getPrisma().pairedDevice.findMany({
        where: { jellyfinUserId: user.userId },
        orderBy: { createdAt: "desc" },
      });
      return devices.map(toView);
    },
  );

  // ── DELETE /my-devices/:id — Revoke own paired device (auth required) ──
  app.delete(
    "/my-devices/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = (request as unknown as { user: JellyfinUser }).user;
      const { id } = request.params as { id: string };
      const prisma = getPrisma();

      const device = await prisma.pairedDevice.findUnique({ where: { id } });
      if (!device || device.jellyfinUserId !== user.userId) {
        return reply.status(404).send({ message: "Appareil introuvable" });
      }

      await prisma.pairedDevice.delete({ where: { id } });
      // Déconfigure immédiatement l'appareil s'il a une socket ouverte
      // (sinon la révocation n'est détectée que passivement, au prochain 401).
      revokeDeviceByTokenHash(device.tokenHash);
      return { success: true };
    },
  );

  // ── GET /devices — List paired devices (admin only) ──
  app.get("/devices", { preHandler: [requireAdmin] }, async () => {
    const devices = await getPrisma().pairedDevice.findMany({
      orderBy: { createdAt: "desc" },
    });
    return devices.map(toView);
  });

  // ── DELETE /devices/:id — Revoke a paired device (admin only) ──
  app.delete("/devices/:id", { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrisma();
    const device = await prisma.pairedDevice.findUnique({ where: { id } });
    if (!device) return reply.status(404).send({ message: "Appareil introuvable" });
    await prisma.pairedDevice.delete({ where: { id } });
    // Déconfiguration immédiate de la TV/appareil révoqué par l'admin.
    revokeDeviceByTokenHash(device.tokenHash);
    return { success: true };
  });
};
