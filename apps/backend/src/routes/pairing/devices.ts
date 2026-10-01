import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../services/db";
import { getTokenFromRequest, requireAuth, requireAdmin } from "../../middleware/auth";
import type { JellyfinUser } from "../../middleware/auth";
import { hashToken, verifyDeviceToken } from "../../services/jwt";
import { revokePairedDevice } from "../../services/deviceRevocation";

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

/** Les appareils jumelés : ceux du compte, et tous pour l'admin ; et le
 *  déjumelage, toujours par la révocation commune (`deviceRevocation.ts`). */
export const pairedDevicesRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /self/revoke — La TV se déjumelle elle-même ──
  // Authentifiée par le jeton à révoquer : seul celui qui le détient peut le
  // faire oublier. Idempotente : la TV la renvoie jusqu'à confirmation (après
  // un plantage, un serveur coupé), et un jumelage déjà supprimé répond comme
  // un jumelage supprimé à l'instant. Un jeton illisible n'ouvre rien : 401.
  app.post(
    "/self/revoke",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const token = getTokenFromRequest(request);
      if (!token || !(await verifyDeviceToken(token))) {
        return reply.status(401).send({ message: "Jeton d'appareil invalide" });
      }
      await revokePairedDevice({ tokenHash: hashToken(token) }, "self");
      return { revoked: true };
    },
  );

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

      // Refusé partout, TV prévenue en direct, session et jeton Jellyfin fermés.
      await revokePairedDevice({ id }, "user");
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
    if (!(await revokePairedDevice({ id }, "admin"))) {
      return reply.status(404).send({ message: "Appareil introuvable" });
    }
    return { success: true };
  });
};
