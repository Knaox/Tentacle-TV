import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { signDeviceToken, hashToken } from "../services/jwt";

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

      // Register the paired device
      await prisma.pairedDevice.create({
        data: {
          name: body.deviceName || record.deviceName || "TV",
          jellyfinUserId: record.jellyfinUserId!,
          username: record.username!,
          tokenHash: hashToken(record.token),
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

      const prisma = getPrisma();
      await prisma.pairedDevice.create({
        data: {
          name: "TV",
          jellyfinUserId: user.userId,
          username: user.username,
          tokenHash: hashToken(token),
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
  app.delete(
    "/devices/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const prisma = getPrisma();

      const device = await prisma.pairedDevice.findUnique({ where: { id } });
      if (!device) {
        return reply.status(404).send({ message: "Appareil introuvable" });
      }

      await prisma.pairedDevice.delete({ where: { id } });
      return { success: true };
    },
  );
};
