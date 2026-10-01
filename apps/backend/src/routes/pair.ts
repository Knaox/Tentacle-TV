import type { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { signDeviceToken, hashToken } from "../services/jwt";
import { provisionOwnJellyfinToken } from "../services/deviceJellyfinToken";
import { CODE_TTL_MS, claimSchema, freshPairingCode, generateSchema } from "./pairing/codes";
import { devicePairingRoutes } from "./pairing/deviceFlow";
import { pairedDevicesRoutes } from "./pairing/devices";

/**
 * Le jumelage des téléviseurs. Trois façons de naître — code généré par le
 * web (`/generate` puis `/claim`), code affiché par la TV
 * (`pairing/deviceFlow.ts`), relais public (`/tv-token`) — et une seule
 * forme : une ligne `paired_devices` (l'empreinte d'un jeton d'appareil qui
 * n'expire pas) et un jeton Jellyfin PROPRE à la TV, frappé pour elle
 * (`deviceJellyfinToken.ts`) — jamais la copie de celui du confirmateur.
 */
export const pairRoutes: FastifyPluginAsync = async (app) => {
  await app.register(devicePairingRoutes);
  await app.register(pairedDevicesRoutes);

  // ── POST /generate — Web user generates a pairing code (auth required) ──
  app.post(
    "/generate",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const user = (request as unknown as { user: JellyfinUser }).user;
      const body = generateSchema.parse(request.body ?? {});
      const code = await freshPairingCode();
      if (!code) {
        return reply
          .status(503)
          .send({ message: "Impossible de générer un code, réessayez." });
      }

      // Generate long-lived JWT for the future TV device
      const deviceId = crypto.randomUUID();
      const token = await signDeviceToken({
        userId: user.userId,
        username: user.username,
        isAdmin: user.isAdmin,
        deviceId,
      });

      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await getPrisma().pairingCode.create({
        data: {
          code,
          deviceName: body.deviceName ?? "TV",
          deviceId,
          expiresAt,
          jellyfinUserId: user.userId,
          username: user.username,
          token,
          status: "pending",
        },
      });

      return { code, expiresAt: expiresAt.toISOString() };
    },
  );

  // ── GET /status/:code — Web polls to see if TV claimed the code (auth required) ──
  app.get(
    "/status/:code",
    { preHandler: [requireAuth] },
    async (request) => {
      const { code } = request.params as { code: string };
      const prisma = getPrisma();

      const record = await prisma.pairingCode.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!record) {
        return { status: "expired" };
      }

      if (record.expiresAt < new Date()) {
        await prisma.pairingCode.delete({ where: { id: record.id } }).catch(() => {});
        return { status: "expired" };
      }

      if (record.status === "confirmed") {
        await prisma.pairingCode.delete({ where: { id: record.id } }).catch(() => {});
        return { status: "confirmed", deviceName: record.deviceName };
      }

      return { status: record.status };
    },
  );

  // ── POST /claim — TV claims a pairing code and gets a token (no auth) ──
  app.post(
    "/claim",
    { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const body = claimSchema.parse(request.body);
      const prisma = getPrisma();

      const record = await prisma.pairingCode.findUnique({
        where: { code: body.code },
      });

      if (!record || record.expiresAt < new Date()) {
        return reply.status(400).send({ message: "Code invalide ou expiré" });
      }

      if (record.status !== "pending") {
        return reply.status(409).send({ message: "Code déjà utilisé" });
      }

      if (!record.token) {
        return reply.status(400).send({ message: "Code invalide" });
      }

      const name = body.deviceName || record.deviceName || "TV";
      await prisma.pairedDevice.create({
        data: {
          name,
          jellyfinUserId: record.jellyfinUserId!,
          username: record.username!,
          tokenHash: hashToken(record.token),
        },
      });
      // Son propre jeton Jellyfin, pour le direct et sa session.
      provisionOwnJellyfinToken(record.token, { jellyfinUserId: record.jellyfinUserId!, name });

      // Mark as claimed
      await prisma.pairingCode.update({
        where: { id: record.id },
        data: { status: "confirmed" },
      });

      // Derive the server URL from the request so the TV knows where to connect
      const proto = request.headers["x-forwarded-proto"] || request.protocol;
      const host = request.headers["x-forwarded-host"] || request.hostname;
      const serverUrl = `${proto}://${host}`;

      return {
        token: record.token,
        userId: record.jellyfinUserId,
        username: record.username,
        serverUrl,
      };
    },
  );

  // ── POST /tv-token — Generate a long-lived TV token (relay flow, auth required) ──
  app.post(
    "/tv-token",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (request) => {
      const user = (request as unknown as { user: JellyfinUser }).user;
      const deviceId = crypto.randomUUID();

      const token = await signDeviceToken({
        userId: user.userId,
        username: user.username,
        isAdmin: user.isAdmin,
        deviceId,
      });

      await getPrisma().pairedDevice.create({
        data: {
          name: "TV",
          jellyfinUserId: user.userId,
          username: user.username,
          tokenHash: hashToken(token),
        },
      });
      // Le relais ne transporte pas le nom de la TV : « TV », renommée à sa
      // première requête (`deviceNaming.ts`) — Jellyfin suit à la suivante.
      provisionOwnJellyfinToken(token, { jellyfinUserId: user.userId, name: "TV" });

      return { token };
    },
  );
};
