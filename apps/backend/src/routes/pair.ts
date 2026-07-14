import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { signDeviceToken, hashToken } from "../services/jwt";
import { findValidSiblingToken } from "../services/deviceTokenHealth";
import { revokeDeviceByTokenHash } from "../services/wsManager";

const PAIR_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes)
    .map((b) => PAIR_CHARS[b % PAIR_CHARS.length])
    .join("");
}

const generateSchema = z.object({
  deviceName: z.string().max(100).optional(),
});

const claimSchema = z.object({
  code: z
    .string()
    .length(4)
    .transform((s) => s.toUpperCase()),
  deviceName: z.string().max(100).optional(),
});

export const pairRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /generate — Web user generates a pairing code (auth required) ──
  app.post(
    "/generate",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const user = (request as any).user as JellyfinUser;
      const body = generateSchema.parse(request.body ?? {});
      const prisma = getPrisma();

      // Clean expired codes opportunistically
      await prisma.pairingCode.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      // Generate unique code (retry on collision)
      let code = "";
      for (let i = 0; i < 10; i++) {
        const candidate = generateCode();
        const existing = await prisma.pairingCode.findUnique({
          where: { code: candidate },
        });
        if (!existing) {
          code = candidate;
          break;
        }
      }

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

      // Capture the web user's Jellyfin token for direct streaming on the paired device
      const authHeader = request.headers.authorization as string | undefined;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7)
        : (request as any).cookies?.tentacle_token || null;
      // Jellyfin tokens are opaque hex strings; JWTs have 3 dot-separated parts
      const isJellyfinToken = bearerToken && !(bearerToken.includes(".") && bearerToken.split(".").length === 3);
      // Confirmateur en JWT (cookie web/desktop) : rien à copier → on grave le
      // dernier token Jellyfin VALIDE d'un autre appareil du même compte, sinon
      // le direct streaming du nouvel appareil serait mort-né (token null).
      const jellyfinAccessToken = isJellyfinToken ? bearerToken : await findValidSiblingToken(user.userId);

      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await prisma.pairingCode.create({
        data: {
          code,
          deviceName: body.deviceName ?? "TV",
          deviceId,
          expiresAt,
          jellyfinUserId: user.userId,
          username: user.username,
          token,
          jellyfinAccessToken,
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

      // Register the paired device (include Jellyfin token for direct streaming)
      await prisma.pairedDevice.create({
        data: {
          name: body.deviceName || record.deviceName || "TV",
          jellyfinUserId: record.jellyfinUserId!,
          username: record.username!,
          tokenHash: hashToken(record.token),
          jellyfinAccessToken: record.jellyfinAccessToken,
        },
      });

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

  // ── Flux « appareil » (manuel, sans relay) : la TV AFFICHE un code, ──────
  // ── l'utilisateur le confirme depuis le téléphone/web connecté.     ──────
  // Même mécanique que le relay public, mais hébergée par ce serveur.

  // ── POST /device/generate — TV génère un code à afficher (sans auth) ──
  app.post(
    "/device/generate",
    { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const body = generateSchema.parse(request.body ?? {});
      const prisma = getPrisma();

      await prisma.pairingCode.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      let code = "";
      for (let i = 0; i < 10; i++) {
        const candidate = generateCode();
        const existing = await prisma.pairingCode.findUnique({
          where: { code: candidate },
        });
        if (!existing) {
          code = candidate;
          break;
        }
      }

      if (!code) {
        return reply
          .status(503)
          .send({ message: "Impossible de générer un code, réessayez." });
      }

      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await prisma.pairingCode.create({
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
      const user = (request as any).user as JellyfinUser;
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

      // Jeton Jellyfin du confirmateur pour le streaming direct (comme /generate) ;
      // confirmateur en JWT → dernier token valide d'un appareil frère du compte.
      const authHeader = request.headers.authorization as string | undefined;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7)
        : (request as any).cookies?.tentacle_token || null;
      const isJellyfinToken = bearerToken && !(bearerToken.includes(".") && bearerToken.split(".").length === 3);
      const jellyfinAccessToken = isJellyfinToken ? bearerToken : await findValidSiblingToken(user.userId);

      await prisma.pairedDevice.create({
        data: {
          name: record.deviceName || "TV",
          jellyfinUserId: user.userId,
          username: user.username,
          tokenHash: hashToken(token),
          jellyfinAccessToken,
        },
      });

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

  // ── POST /tv-token — Generate a long-lived TV token (relay flow, auth required) ──
  app.post(
    "/tv-token",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (request) => {
      const user = (request as any).user as JellyfinUser;
      const deviceId = crypto.randomUUID();

      const token = await signDeviceToken({
        userId: user.userId,
        username: user.username,
        isAdmin: user.isAdmin,
        deviceId,
      });

      // Capture Jellyfin token for direct streaming ; confirmateur en JWT →
      // dernier token valide d'un appareil frère du compte.
      const authHeader = request.headers.authorization as string | undefined;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7)
        : (request as any).cookies?.tentacle_token || null;
      const isJellyfinToken = bearerToken && !(bearerToken.includes(".") && bearerToken.split(".").length === 3);
      const jellyfinAccessToken = isJellyfinToken ? bearerToken : await findValidSiblingToken(user.userId);

      const prisma = getPrisma();
      await prisma.pairedDevice.create({
        data: {
          name: "TV",
          jellyfinUserId: user.userId,
          username: user.username,
          tokenHash: hashToken(token),
          jellyfinAccessToken,
        },
      });

      return { token };
    },
  );

  // ── GET /my-devices — List current user's paired devices (auth required) ──
  app.get(
    "/my-devices",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = (request as any).user as JellyfinUser;
      const prisma = getPrisma();
      const devices = await prisma.pairedDevice.findMany({
        where: { jellyfinUserId: user.userId },
        orderBy: { createdAt: "desc" },
      });
      return devices.map((d: any) => ({
        id: d.id,
        name: d.name,
        username: d.username,
        jellyfinUserId: d.jellyfinUserId,
        lastSeen: d.lastSeen,
        createdAt: d.createdAt,
      }));
    },
  );

  // ── DELETE /my-devices/:id — Revoke own paired device (auth required) ──
  app.delete(
    "/my-devices/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = (request as any).user as JellyfinUser;
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
    const prisma = getPrisma();
    const devices = await prisma.pairedDevice.findMany({
      orderBy: { createdAt: "desc" },
    });
    return devices.map((d: any) => ({
      id: d.id,
      name: d.name,
      username: d.username,
      jellyfinUserId: d.jellyfinUserId,
      lastSeen: d.lastSeen,
      createdAt: d.createdAt,
    }));
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
