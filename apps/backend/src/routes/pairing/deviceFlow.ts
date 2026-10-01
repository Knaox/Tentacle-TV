import type { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { getPrisma } from "../../services/db";
import { requireAuth } from "../../middleware/auth";
import type { JellyfinUser } from "../../middleware/auth";
import { signDeviceToken, hashToken } from "../../services/jwt";
import { provisionOwnJellyfinToken } from "../../services/deviceJellyfinToken";
import { CODE_TTL_MS, claimSchema, freshPairingCode, generateSchema } from "./codes";

/**
 * Flux « appareil » (manuel, sans relay) : la TV AFFICHE un code,
 * l'utilisateur le confirme depuis le téléphone/web connecté. Même mécanique
 * que le relay public, mais hébergée par ce serveur. Extrait de `pair.ts`.
 */
export const devicePairingRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /device/generate — TV génère un code à afficher (sans auth) ──
  app.post(
    "/device/generate",
    { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const body = generateSchema.parse(request.body ?? {});
      const code = await freshPairingCode();
      if (!code) {
        return reply
          .status(503)
          .send({ message: "Impossible de générer un code, réessayez." });
      }

      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await getPrisma().pairingCode.create({
        data: {
          code,
          deviceName: body.deviceName ?? "TV",
          deviceId: crypto.randomUUID(),
          expiresAt,
          status: "device_pending",
        },
      });

      return { code, expiresIn: CODE_TTL_MS / 1000 };
    },
  );

  // ── GET /device/status/:code — TV poll : confirmé ? (sans auth) ──
  // Le token n'est délivré qu'une fois (l'enregistrement est supprimé après).
  app.get("/device/status/:code", async (request) => {
    const { code } = request.params as { code: string };
    const prisma = getPrisma();

    const record = await prisma.pairingCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    // Ne répond que pour les codes initiés par un appareil (pas le flux /claim)
    if (!record || !record.status.startsWith("device_")) {
      return { status: "expired" };
    }

    if (record.expiresAt < new Date()) {
      await prisma.pairingCode.delete({ where: { id: record.id } }).catch(() => {});
      return { status: "expired" };
    }

    if (record.status === "device_confirmed" && record.token) {
      await prisma.pairingCode.delete({ where: { id: record.id } }).catch(() => {});
      return {
        status: "confirmed",
        token: record.token,
        user: { id: record.jellyfinUserId, name: record.username },
      };
    }

    return { status: "pending" };
  });

  // ── POST /device/confirm — Le téléphone/web confirme le code affiché par la TV (auth) ──
  app.post(
    "/device/confirm",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const user = (request as unknown as { user: JellyfinUser }).user;
      const body = claimSchema.parse(request.body);
      const prisma = getPrisma();

      const record = await prisma.pairingCode.findUnique({
        where: { code: body.code },
      });

      if (!record || record.status !== "device_pending" || record.expiresAt < new Date()) {
        return reply.status(404).send({ message: "Code invalide ou expiré" });
      }

      const token = await signDeviceToken({
        userId: user.userId,
        username: user.username,
        isAdmin: user.isAdmin,
        deviceId: record.deviceId ?? crypto.randomUUID(),
      });

      const name = record.deviceName || "TV";
      await prisma.pairedDevice.create({
        data: {
          name,
          jellyfinUserId: user.userId,
          username: user.username,
          tokenHash: hashToken(token),
        },
      });
      // Son propre jeton Jellyfin, jamais celui du confirmateur.
      provisionOwnJellyfinToken(token, { jellyfinUserId: user.userId, name });

      await prisma.pairingCode.update({
        where: { id: record.id },
        data: {
          status: "device_confirmed",
          token,
          jellyfinUserId: user.userId,
          username: user.username,
        },
      });

      return { success: true, deviceName: record.deviceName };
    },
  );
};
